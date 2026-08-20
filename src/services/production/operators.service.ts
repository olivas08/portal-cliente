import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import type { OperatorActor } from "@/lib/operator-session";
import { PIN_SALT_ROUNDS } from "@/services/production/shared";
import { assertRateLimit, getClientIp } from "@/lib/rate-limit";

// ── Schemas ─────────────────────────────────────────────────────────────────

export const operatorLoginSchema = z.object({
  operatorId: z.string().trim().min(1, "Selecione o operador."),
  pin: z.string().trim().min(4, "PIN deve ter pelo menos 4 dígitos.").max(12),
});
export type OperatorLoginInput = z.infer<typeof operatorLoginSchema>;

const pinSchema = z
  .string()
  .trim()
  .regex(/^\d{4,12}$/, "PIN deve ter entre 4 e 12 dígitos.");

export const createOperatorSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório.").max(80),
  pin: pinSchema,
});
export type CreateOperatorInput = z.infer<typeof createOperatorSchema>;

export const resetOperatorPinSchema = z.object({
  operatorId: z.string().trim().min(1, "Operador obrigatório."),
  pin: pinSchema,
});
export type ResetOperatorPinInput = z.infer<typeof resetOperatorPinSchema>;

export const setOperatorActiveSchema = z.object({
  operatorId: z.string().trim().min(1, "Operador obrigatório."),
  active: z.boolean(),
});
export type SetOperatorActiveInput = z.infer<typeof setOperatorActiveSchema>;

// ── Operator authentication ─────────────────────────────────────────────────

/**
 * Validates an operator PIN against the stored bcrypt hash. Returns the
 * operator identity on success; the action layer is responsible for issuing
 * the signed cookie.
 */
export async function loginOperator(
  input: OperatorLoginInput,
): Promise<OperatorActor> {
  // The shop-floor terminal (/producao/terminal) is intentionally public
  // (no account login) and lists operator names/ids in the picker, so a
  // 4-digit PIN is only as safe as the attempt limit behind it. Rate-limit
  // per operator (tight) and per IP (looser, since one kiosk serves many
  // operators across a shift) before paying for the bcrypt compare.
  const ip = await getClientIp();
  await assertRateLimit(`operator-login:operator:${input.operatorId}`, {
    max: 5,
    windowMs: 5 * 60 * 1000,
  });
  await assertRateLimit(`operator-login:ip:${ip}`, {
    max: 20,
    windowMs: 5 * 60 * 1000,
  });

  const operator = await prisma.operator.findUnique({
    where: { id: input.operatorId },
  });
  if (!operator || !operator.active) {
    throw new UnauthorizedError("Operador não encontrado.");
  }
  const valid = await bcrypt.compare(input.pin, operator.pinHash);
  if (!valid) throw new UnauthorizedError("PIN incorreto.");
  return { id: operator.id, name: operator.name };
}

/** Creates a shop-floor operator with a bcrypt-hashed PIN. */
export async function createOperator(input: CreateOperatorInput): Promise<void> {
  const pinHash = await bcrypt.hash(input.pin, PIN_SALT_ROUNDS);
  await prisma.operator.create({
    data: { name: input.name, pinHash },
  });
  invalidateCache(CACHE_TAGS.operators);
}

/** Resets an operator's PIN (e.g. when forgotten). */
export async function resetOperatorPin(
  input: ResetOperatorPinInput,
): Promise<void> {
  const operator = await prisma.operator.findUnique({
    where: { id: input.operatorId },
    select: { id: true },
  });
  if (!operator) throw new NotFoundError("Operador não encontrado.");
  const pinHash = await bcrypt.hash(input.pin, PIN_SALT_ROUNDS);
  await prisma.operator.update({
    where: { id: input.operatorId },
    data: { pinHash },
  });
  invalidateCache(CACHE_TAGS.operators);
}

/**
 * Activates/deactivates an operator. Deactivating preserves all history but
 * removes the operator from the terminal login and active lists.
 */
export async function setOperatorActive(
  input: SetOperatorActiveInput,
): Promise<void> {
  const operator = await prisma.operator.findUnique({
    where: { id: input.operatorId },
    select: { id: true },
  });
  if (!operator) throw new NotFoundError("Operador não encontrado.");
  await prisma.operator.update({
    where: { id: input.operatorId },
    data: { active: input.active },
  });
  invalidateCache(CACHE_TAGS.operators);
}
