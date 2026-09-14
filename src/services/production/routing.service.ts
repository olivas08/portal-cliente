import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { NotFoundError, AppError } from "@/lib/errors";
import type { OperatorActor } from "@/lib/operator-session";
import {
  elapsedMinutes,
  isStepReady,
  canStartStep,
  canPauseStep,
  canCompleteStep,
  canDeclareStepDone,
  canReworkStep,
  rollUpWorkOrderStatus,
} from "@/services/production-status";
import {
  applyOrderRollup,
  dispatchOrderNotification,
  dispatchStageNotification,
  type StageNotification,
} from "@/services/production/shared";
import { reconcileOrphanReadings } from "@/services/production/machines.service";

// ── Schemas ─────────────────────────────────────────────────────────────────

export const stepIdSchema = z.object({
  stepId: z.string().trim().min(1, "Passo obrigatório."),
});

export const nonConformityIdSchema = z.object({
  id: z.string().trim().min(1, "Não-conformidade obrigatória."),
});

export const completeStepSchema = z.object({
  stepId: z.string().trim().min(1, "Passo obrigatório."),
  quantityDone: z.coerce.number().nonnegative("Quantidade inválida."),
  scrapQty: z.coerce.number().nonnegative("Sucata inválida.").default(0),
  defect: z
    .object({
      quantity: z.coerce.number().positive("Quantidade não conforme inválida."),
      reason: z.string().trim().min(1, "Motivo obrigatório.").max(200),
      disposition: z.enum(["rework", "scrap"]),
    })
    .optional(),
});
export type CompleteStepInput = z.infer<typeof completeStepSchema>;

export const setProductRoutingSchema = z.object({
  productId: z.string().trim().min(1, "Produto obrigatório."),
  operations: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Nome da operação obrigatório.").max(80),
        workstationId: z.string().trim().min(1, "Posto obrigatório."),
        plannedMinutes: z.coerce
          .number()
          .int("Minutos devem ser inteiros.")
          .nonnegative("Minutos inválidos."),
      }),
    )
    .max(20, "Roteiro demasiado longo."),
});
export type SetProductRoutingInput = z.infer<typeof setProductRoutingSchema>;

// ── Routing templates ───────────────────────────────────────────────────────

/**
 * Replaces a product's routing with the given ordered operations (delete +
 * recreate in one transaction). Sequence is derived from array order.
 */
export async function setProductRouting(
  input: SetProductRoutingInput,
): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true },
  });
  if (!product) throw new NotFoundError("Produto não encontrado.");

  if (input.operations.length > 0) {
    const ids = [...new Set(input.operations.map((o) => o.workstationId))];
    const found = await prisma.workstation.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      throw new AppError("Posto de trabalho inválido no roteiro.");
    }
  }

  await prisma.$transaction([
    prisma.routingOperation.deleteMany({ where: { productId: input.productId } }),
    prisma.routingOperation.createMany({
      data: input.operations.map((op, index) => ({
        productId: input.productId,
        sequence: index + 1,
        name: op.name,
        workstationId: op.workstationId,
        plannedMinutes: op.plannedMinutes,
      })),
    }),
  ]);
  invalidateCache(CACHE_TAGS.routing);
}

// ── Quality: non-conformities & rework ───────────────────────────────────────

/**
 * Reopens a completed step for reprocessing: the step returns to `pending`
 * (re-entering its station queue) and the work order status is recomputed.
 * Any open rework non-conformity on that step is marked resolved.
 */
export async function reworkStep(stepId: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const step = await tx.workOrderStep.findUnique({
      where: { id: stepId },
      include: { workOrder: { include: { steps: true } } },
    });
    if (!step) throw new NotFoundError("Passo não encontrado.");
    if (!canReworkStep(step.status)) {
      throw new AppError("Só passos concluídos podem ser reprocessados.");
    }
    const wo = step.workOrder;
    if (wo.status === "cancelled") {
      throw new AppError("Ordem de fabrico cancelada.");
    }

    await tx.workOrderStep.update({
      where: { id: stepId },
      data: { status: "pending", finishedAt: null, quantityDone: 0 },
    });

    const nextSteps = wo.steps.map((s) =>
      s.id === stepId ? { ...s, status: "pending" as const } : s,
    );
    const woStatus = rollUpWorkOrderStatus(
      wo.status === "done" ? "in_progress" : wo.status,
      nextSteps,
    );
    await tx.workOrder.update({
      where: { id: wo.id },
      data: {
        status: woStatus,
        finishedAt: woStatus === "done" ? wo.finishedAt : null,
      },
    });

    await tx.nonConformity.updateMany({
      where: { stepId, disposition: "rework", status: "open" },
      data: { status: "resolved", resolvedAt: now },
    });
  });
  invalidateCache(CACHE_TAGS.workOrders);
  invalidateCache(CACHE_TAGS.nonConformities);
}

/** Marks a non-conformity resolved (e.g. after scrapping the defective parts). */
export async function resolveNonConformity(id: string): Promise<void> {
  const nc = await prisma.nonConformity.findUnique({ where: { id } });
  if (!nc) throw new NotFoundError("Não-conformidade não encontrada.");
  if (nc.status === "resolved") return;
  await prisma.nonConformity.update({
    where: { id },
    data: { status: "resolved", resolvedAt: new Date() },
  });
  invalidateCache(CACHE_TAGS.nonConformities);
}

// ── Shop-floor execution ────────────────────────────────────────────────────

/** Starts (or resumes) a step. `operator` is null when an office user
 * records the start without the shop-floor terminal. */
export async function startStep(
  operator: OperatorActor | null,
  stepId: string,
): Promise<void> {
  const now = new Date();
  const notify = await prisma.$transaction(async (tx) => {
    const step = await tx.workOrderStep.findUnique({
      where: { id: stepId },
      include: { workOrder: { include: { steps: true, order: true } } },
    });
    if (!step) throw new NotFoundError("Passo não encontrado.");

    const wo = step.workOrder;
    if (wo.status === "planned") {
      throw new AppError("Lance a ordem de fabrico antes de a iniciar.");
    }
    if (wo.status === "cancelled") {
      throw new AppError("Esta ordem de fabrico foi cancelada.");
    }
    if (!canStartStep(step.status)) {
      throw new AppError("Este passo já está em curso ou concluído.");
    }
    if (!isStepReady(step, wo.steps)) {
      throw new AppError("Conclua primeiro os passos anteriores.");
    }

    await tx.workOrderStep.update({
      where: { id: stepId },
      data: {
        status: "in_progress",
        startedAt: now,
        pausedAt: null,
        downtimeMinutes:
          step.status === "paused" && step.pausedAt
            ? step.downtimeMinutes + elapsedMinutes(step.pausedAt, now)
            : step.downtimeMinutes,
        operatorId: operator?.id ?? null,
      },
    });

    // Bind any machine pulses that arrived before the operator started the
    // step (produced during setup) so those counts are not lost.
    await reconcileOrphanReadings(tx, stepId, step.workstationId, now);

    const nextSteps = wo.steps.map((s) =>
      s.id === stepId ? { ...s, status: "in_progress" as const } : s,
    );
    const woStatus = rollUpWorkOrderStatus(wo.status, nextSteps);
    await tx.workOrder.update({
      where: { id: wo.id },
      data: { status: woStatus, startedAt: wo.startedAt ?? now },
    });

    return applyOrderRollup(tx, wo.orderId);
  });

  await dispatchOrderNotification(notify);
  invalidateCache(CACHE_TAGS.workOrders);
  invalidateCache(CACHE_TAGS.orders);
  invalidateCache(CACHE_TAGS.machines);
}

/** Pauses a running step, banking the elapsed run time. */
export async function pauseStep(
  operator: OperatorActor,
  stepId: string,
): Promise<void> {
  const now = new Date();
  const step = await prisma.workOrderStep.findUnique({ where: { id: stepId } });
  if (!step) throw new NotFoundError("Passo não encontrado.");
  if (!canPauseStep(step.status)) {
    throw new AppError("Só é possível pausar um passo em curso.");
  }
  await prisma.workOrderStep.update({
    where: { id: stepId },
    data: {
      status: "paused",
      startedAt: null,
      pausedAt: now,
      actualMinutes: step.actualMinutes + elapsedMinutes(step.startedAt, now),
      operatorId: operator.id,
    },
  });
  invalidateCache(CACHE_TAGS.workOrders);
  invalidateCache(CACHE_TAGS.machines);
}

/** Completes a step, recording good/scrap quantities and rolling up state.
 * Pass `operator` null for office/pilot declaration (pending steps allowed). */
export async function completeStep(
  operator: OperatorActor | null,
  input: CompleteStepInput,
): Promise<void> {
  const now = new Date();
  const notify = await prisma.$transaction(async (tx) => {
    const step = await tx.workOrderStep.findUnique({
      where: { id: input.stepId },
      include: {
        workstation: { select: { clientStageLabel: true } },
        workOrder: { include: { steps: true, order: true } },
      },
    });
    if (!step) throw new NotFoundError("Passo não encontrado.");

    const wo = step.workOrder;
    if (operator) {
      if (!canCompleteStep(step.status)) {
        throw new AppError("Este passo não pode ser concluído.");
      }
    } else {
      if (!canDeclareStepDone(step.status)) {
        throw new AppError("Este passo não pode ser concluído.");
      }
      if (!isStepReady(step, wo.steps)) {
        throw new AppError("Conclua primeiro os passos anteriores.");
      }
      if (wo.status === "planned") {
        throw new AppError("Lance a ordem de fabrico antes de a concluir.");
      }
      if (wo.status === "cancelled") {
        throw new AppError("Esta ordem de fabrico foi cancelada.");
      }
    }
    const machineVerified = step.machineVerified;
    const finalQty = machineVerified ? step.quantityDone : input.quantityDone;
    const finalScrap = machineVerified ? step.scrapQty : input.scrapQty;
    await tx.workOrderStep.update({
      where: { id: input.stepId },
      data: {
        status: "done",
        finishedAt: now,
        startedAt: null,
        actualMinutes: step.actualMinutes + elapsedMinutes(step.startedAt, now),
        quantityDone: finalQty,
        scrapQty: finalScrap,
        declaredQty: input.quantityDone,
        operatorId: operator?.id ?? null,
      },
    });

    if (input.defect) {
      await tx.nonConformity.create({
        data: {
          workOrderId: wo.id,
          stepId: input.stepId,
          quantity: input.defect.quantity,
          reason: input.defect.reason,
          disposition: input.defect.disposition,
          operatorId: operator?.id ?? null,
        },
      });
    }

    const nextSteps = wo.steps.map((s) =>
      s.id === input.stepId ? { ...s, status: "done" as const } : s,
    );
    const woStatus = rollUpWorkOrderStatus(wo.status, nextSteps);
    const woDone = woStatus === "done";
    await tx.workOrder.update({
      where: { id: wo.id },
      data: {
        status: woStatus,
        finishedAt: woDone ? now : wo.finishedAt,
        quantityDone: woDone ? finalQty : wo.quantityDone,
      },
    });

    const order = await applyOrderRollup(tx, wo.orderId, now);

    // A stage-level notification is only worthwhile when the order status did
    // not already change (that carries its own, higher-signal notification).
    let stage: StageNotification | null = null;
    if (!order) {
      const label = step.workstation.clientStageLabel;
      const stageSteps = await tx.workOrderStep.findMany({
        where: {
          workstation: { clientStageLabel: label },
          workOrder: { orderId: wo.orderId, status: { not: "cancelled" } },
        },
        select: { status: true },
      });
      const stageDone =
        stageSteps.length > 0 && stageSteps.every((s) => s.status === "done");
      if (stageDone) {
        stage = {
          companyId: wo.order.companyId,
          reference: wo.order.reference,
          orderId: wo.orderId,
          stageLabel: label,
        };
      }
    }

    return { order, stage };
  });

  await dispatchOrderNotification(notify.order);
  await dispatchStageNotification(notify.stage);
  invalidateCache(CACHE_TAGS.workOrders);
  invalidateCache(CACHE_TAGS.orders);
  invalidateCache(CACHE_TAGS.machines);
  if (input.defect) invalidateCache(CACHE_TAGS.nonConformities);
}

/** Office: start the current ready step (released → in_progress). */
export async function startStepFromOffice(stepId: string): Promise<void> {
  await startStep(null, stepId);
}

/** Office: complete a ready step using the planned quantity (no tablet). */
export async function completeStepFromOffice(stepId: string): Promise<void> {
  const step = await prisma.workOrderStep.findUnique({
    where: { id: stepId },
    select: { workOrder: { select: { quantityPlanned: true } } },
  });
  if (!step) throw new NotFoundError("Passo não encontrado.");
  await completeStep(null, {
    stepId,
    quantityDone: step.workOrder.quantityPlanned,
    scrapQty: 0,
  });
}

/**
 * Office: mark every remaining step done, in sequence, with planned qty.
 * Used when the factory still tracks production on paper.
 */
export async function completeWorkOrderFromOffice(
  workOrderId: string,
): Promise<void> {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { steps: { orderBy: { sequence: "asc" } } },
  });
  if (!wo) throw new NotFoundError("Ordem de fabrico não encontrada.");
  if (wo.status === "planned") {
    throw new AppError("Lance a ordem de fabrico antes de a concluir.");
  }
  if (wo.status === "cancelled") {
    throw new AppError("Esta ordem de fabrico foi cancelada.");
  }
  if (wo.status === "done") return;

  for (const step of wo.steps) {
    if (step.status === "done") continue;
    await completeStep(null, {
      stepId: step.id,
      quantityDone: wo.quantityPlanned,
      scrapQty: 0,
    });
  }
}
