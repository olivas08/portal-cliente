import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { downtimeOnResume, type MachineState } from "@/services/production-status";
import { PIN_SALT_ROUNDS, type TxClient } from "@/services/production/shared";
import { assertRateLimit, getClientIp } from "@/lib/rate-limit";

// ── Schemas ─────────────────────────────────────────────────────────────────

const machineTokenSchema = z
  .string()
  .trim()
  .min(6, "Token deve ter pelo menos 6 caracteres.")
  .max(120);

export const createMachineSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Código obrigatório.")
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Use apenas letras, números, - ou _."),
  name: z.string().trim().min(2, "Nome obrigatório.").max(80),
  workstationId: z.string().trim().min(1).nullish(),
  token: machineTokenSchema,
});
export type CreateMachineInput = z.infer<typeof createMachineSchema>;

export const setMachineActiveSchema = z.object({
  machineId: z.string().trim().min(1),
  active: z.boolean(),
});
export type SetMachineActiveInput = z.infer<typeof setMachineActiveSchema>;

export const regenerateMachineTokenSchema = z.object({
  machineId: z.string().trim().min(1),
  token: machineTokenSchema,
});
export type RegenerateMachineTokenInput = z.infer<
  typeof regenerateMachineTokenSchema
>;

export const machineIngestSchema = z.object({
  machineCode: z.string().trim().min(1),
  token: z.string().min(1),
  eventId: z.string().trim().min(1).max(200),
  goodDelta: z.number().int().min(0).max(100000).default(0),
  scrapDelta: z.number().int().min(0).max(100000).default(0),
  producedAt: z.string().datetime().optional(),
});
export type MachineIngestInput = z.infer<typeof machineIngestSchema>;

export const machineStatusSchema = z.object({
  machineCode: z.string().trim().min(1),
  token: z.string().min(1),
  state: z.enum(["run", "idle", "down", "offline"]),
  at: z.string().datetime().optional(),
});
export type MachineStatusInput = z.infer<typeof machineStatusSchema>;

// ── Machine (edge device) management ────────────────────────────────────────

/** Registers a machine (edge device) with a bcrypt-hashed access token. */
export async function createMachine(input: CreateMachineInput): Promise<void> {
  const tokenHash = await bcrypt.hash(input.token, PIN_SALT_ROUNDS);
  await prisma.machine.create({
    data: {
      code: input.code,
      name: input.name,
      workstationId: input.workstationId ?? null,
      tokenHash,
    },
  });
  invalidateCache(CACHE_TAGS.machines);
}

export async function setMachineActive(
  input: SetMachineActiveInput,
): Promise<void> {
  const machine = await prisma.machine.findUnique({
    where: { id: input.machineId },
    select: { id: true },
  });
  if (!machine) throw new NotFoundError("Máquina não encontrada.");
  await prisma.machine.update({
    where: { id: input.machineId },
    data: { active: input.active },
  });
  invalidateCache(CACHE_TAGS.machines);
}

export async function regenerateMachineToken(
  input: RegenerateMachineTokenInput,
): Promise<void> {
  const machine = await prisma.machine.findUnique({
    where: { id: input.machineId },
    select: { id: true },
  });
  if (!machine) throw new NotFoundError("Máquina não encontrada.");
  const tokenHash = await bcrypt.hash(input.token, PIN_SALT_ROUNDS);
  await prisma.machine.update({
    where: { id: input.machineId },
    data: { tokenHash },
  });
  invalidateCache(CACHE_TAGS.machines);
}

export interface MachineIngestResult {
  deduped: boolean;
  machineQty: number;
  scrapQty: number;
  stepId: string | null;
}

/**
 * Records a production event coming directly from a machine (via the edge
 * gateway). The machine's count is the source of truth: it is accumulated onto
 * the in-progress step of the machine's workstation and marks that step as
 * machine-verified, so an operator can no longer overwrite it. Idempotent per
 * (machine, eventId) so retries from the edge buffer never double-count.
 */
export async function recordMachineProduction(
  input: MachineIngestInput,
): Promise<MachineIngestResult> {
  const machine = await authenticateMachine(input.machineCode, input.token);

  const now = new Date();
  const producedAt = input.producedAt ? new Date(input.producedAt) : now;

  return prisma.$transaction(async (tx) => {
    // A production pulse implies the machine is running; bank any downtime that
    // accrued while it was idle/down onto the active step (feeds OEE).
    await applyMachineState(tx, machine, "run", now);

    const existing = await tx.machineReading.findUnique({
      where: {
        machineId_eventId: { machineId: machine.id, eventId: input.eventId },
      },
      select: { id: true, workOrderStepId: true },
    });
    if (existing) {
      return { deduped: true, machineQty: 0, scrapQty: 0, stepId: null };
    }

    const step = machine.workstationId
      ? await tx.workOrderStep.findFirst({
          where: {
            workstationId: machine.workstationId,
            status: "in_progress",
          },
          orderBy: { startedAt: "asc" },
        })
      : null;

    await tx.machineReading.create({
      data: {
        machineId: machine.id,
        eventId: input.eventId,
        goodDelta: input.goodDelta,
        scrapDelta: input.scrapDelta,
        producedAt,
        workOrderStepId: step?.id ?? null,
      },
    });

    if (!step) {
      return { deduped: false, machineQty: 0, scrapQty: 0, stepId: null };
    }

    const updated = await tx.workOrderStep.update({
      where: { id: step.id },
      data: {
        quantityDone: step.quantityDone + input.goodDelta,
        scrapQty: step.scrapQty + input.scrapDelta,
        machineVerified: true,
        machineId: machine.id,
      },
      select: { id: true, quantityDone: true, scrapQty: true },
    });

    return {
      deduped: false,
      machineQty: updated.quantityDone,
      scrapQty: updated.scrapQty,
      stepId: updated.id,
    };
  }).then((result) => {
    invalidateCache(CACHE_TAGS.machines);
    invalidateCache(CACHE_TAGS.workOrders);
    return result;
  });
}

async function authenticateMachine(code: string, token: string) {
  // Defense-in-depth: the token itself is a long random secret so brute
  // force is impractical, but rate-limit anyway in case a token leaks and
  // gets scripted against, and to blunt scanning noise on the endpoint.
  const ip = await getClientIp();
  await assertRateLimit(`machine-auth:code:${code}`, {
    max: 20,
    windowMs: 60 * 60 * 1000,
  });
  await assertRateLimit(`machine-auth:ip:${ip}`, {
    max: 60,
    windowMs: 60 * 60 * 1000,
  });

  const machine = await prisma.machine.findUnique({ where: { code } });
  if (!machine || !machine.active) {
    throw new UnauthorizedError("Máquina não autorizada.");
  }
  const valid = await bcrypt.compare(token, machine.tokenHash);
  if (!valid) throw new UnauthorizedError("Token inválido.");
  return machine;
}

/**
 * Updates a machine's live state and, when it resumes running after being
 * idle/down, banks the elapsed non-productive time onto the active step so OEE
 * availability reflects real machine stoppages (not just operator pauses).
 */
async function applyMachineState(
  tx: TxClient,
  machine: { id: string; state: string; stateSince: Date | null; workstationId: string | null },
  newState: MachineState,
  now: Date,
): Promise<void> {
  if (newState === "run" && machine.workstationId) {
    const downtime = downtimeOnResume(
      machine.state as MachineState,
      machine.stateSince,
      now,
    );
    if (downtime > 0) {
      const step = await tx.workOrderStep.findFirst({
        where: { workstationId: machine.workstationId, status: "in_progress" },
        orderBy: { startedAt: "asc" },
        select: { id: true, downtimeMinutes: true },
      });
      if (step) {
        await tx.workOrderStep.update({
          where: { id: step.id },
          data: { downtimeMinutes: step.downtimeMinutes + downtime },
        });
      }
    }
  }
  const stateChanged = machine.state !== newState;
  await tx.machine.update({
    where: { id: machine.id },
    data: {
      lastSeenAt: now,
      state: newState,
      stateSince: stateChanged ? now : machine.stateSince ?? now,
    },
  });
}

/** Records a machine live-state transition (RUN/IDLE/DOWN/offline). */
export async function recordMachineStatus(
  input: MachineStatusInput,
): Promise<{ state: string }> {
  const machine = await authenticateMachine(input.machineCode, input.token);
  const now = input.at ? new Date(input.at) : new Date();
  await prisma.$transaction((tx) =>
    applyMachineState(tx, machine, input.state, now),
  );
  invalidateCache(CACHE_TAGS.machines);
  invalidateCache(CACHE_TAGS.workOrders);
  return { state: input.state };
}

/**
 * Binds recent orphan machine readings (pulses with no step, produced before
 * the operator started work) for a workstation onto the freshly started step,
 * adding their counts so machine-captured production is never dropped.
 * Exported for use by the routing/execution domain when a step is started.
 */
export async function reconcileOrphanReadings(
  tx: TxClient,
  stepId: string,
  workstationId: string,
  now: Date,
  windowMinutes = 30,
): Promise<void> {
  const machines = await tx.machine.findMany({
    where: { workstationId },
    select: { id: true },
  });
  if (machines.length === 0) return;
  const machineIds = machines.map((m) => m.id);
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const orphans = await tx.machineReading.findMany({
    where: {
      machineId: { in: machineIds },
      workOrderStepId: null,
      receivedAt: { gte: windowStart },
    },
    select: { id: true, goodDelta: true, scrapDelta: true, machineId: true },
  });
  if (orphans.length === 0) return;

  const good = orphans.reduce((s, r) => s + r.goodDelta, 0);
  const scrap = orphans.reduce((s, r) => s + r.scrapDelta, 0);

  await tx.machineReading.updateMany({
    where: { id: { in: orphans.map((o) => o.id) } },
    data: { workOrderStepId: stepId },
  });

  const step = await tx.workOrderStep.findUnique({
    where: { id: stepId },
    select: { quantityDone: true, scrapQty: true },
  });
  if (!step) return;
  await tx.workOrderStep.update({
    where: { id: stepId },
    data: {
      quantityDone: step.quantityDone + good,
      scrapQty: step.scrapQty + scrap,
      machineVerified: true,
      machineId: orphans[0].machineId,
    },
  });
}
