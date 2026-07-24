import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { NotFoundError, AppError, UnauthorizedError } from "@/lib/errors";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import { computeStatusDates } from "@/services/order-status";
import { createWithReference } from "@/services/reference.service";
import { notifyCompanyClients } from "@/services/notifications.service";
import {
  elapsedMinutes,
  isStepReady,
  canStartStep,
  canPauseStep,
  canCompleteStep,
  canReworkStep,
  rollUpWorkOrderStatus,
  deriveOrderStatusFromProduction,
} from "@/services/production-status";
import type { OperatorActor } from "@/lib/operator-session";

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

export const generateWorkOrdersSchema = z.object({
  orderId: z.string().trim().min(1, "Encomenda obrigatória."),
});

export const workOrderIdSchema = z.object({
  workOrderId: z.string().trim().min(1, "Ordem de fabrico obrigatória."),
});

export const setWorkOrderPrioritySchema = z.object({
  workOrderId: z.string().trim().min(1, "Ordem de fabrico obrigatória."),
  priority: z.enum(["normal", "urgent"]),
});
export type SetWorkOrderPriorityInput = z.infer<
  typeof setWorkOrderPrioritySchema
>;

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

const DEFAULT_STEP_MINUTES = 30;

// ── Operator authentication ─────────────────────────────────────────────────

/**
 * Validates an operator PIN against the stored bcrypt hash. Returns the
 * operator identity on success; the action layer is responsible for issuing
 * the signed cookie.
 */
export async function loginOperator(
  input: OperatorLoginInput,
): Promise<OperatorActor> {
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

const PIN_SALT_ROUNDS = 10;

/** Creates a shop-floor operator with a bcrypt-hashed PIN. */
export async function createOperator(input: CreateOperatorInput): Promise<void> {
  const pinHash = await bcrypt.hash(input.pin, PIN_SALT_ROUNDS);
  await prisma.operator.create({
    data: { name: input.name, pinHash },
  });
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
}

// ── Work order planning ─────────────────────────────────────────────────────

/**
 * Generates one work order per order line that does not have one yet, using a
 * default routing built from every active workstation (ordered by sequence).
 * Product reference/name are snapshotted from the order item. Idempotent:
 * lines that already have a work order are skipped.
 */
export async function generateWorkOrdersForOrder(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { workOrders: { select: { id: true } } } } },
  });
  if (!order) throw new NotFoundError("Encomenda não encontrada.");
  if (order.status === "cancelled") {
    throw new AppError("Não é possível planear produção de uma encomenda cancelada.");
  }

  const fallbackStations = await prisma.workstation.findMany({
    where: { active: true },
    orderBy: { sequence: "asc" },
  });
  if (fallbackStations.length === 0) {
    throw new AppError("Configure pelo menos um posto de trabalho.");
  }

  const pending = order.items.filter((item) => item.workOrders.length === 0);
  if (pending.length === 0) {
    throw new AppError("Esta encomenda já tem produção planeada.");
  }

  // Resolve each line to its catalogue product routing (matched by reference).
  const products = await prisma.product.findMany({
    where: { reference: { in: pending.map((i) => i.reference) } },
    include: { routing: { orderBy: { sequence: "asc" } } },
  });
  const routingByRef = new Map(products.map((p) => [p.reference, p.routing]));

  for (const item of pending) {
    const routing = routingByRef.get(item.reference);
    const steps =
      routing && routing.length > 0
        ? routing.map((op, index) => ({
            sequence: index + 1,
            name: op.name,
            workstationId: op.workstationId,
            plannedMinutes: op.plannedMinutes,
          }))
        : fallbackStations.map((ws, index) => ({
            sequence: index + 1,
            name: ws.name,
            workstationId: ws.id,
            plannedMinutes: DEFAULT_STEP_MINUTES,
          }));

    await createWithReference("OF", (reference) =>
      prisma.workOrder.create({
        data: {
          reference,
          orderId: order.id,
          orderItemId: item.id,
          productRef: item.reference,
          productName: item.description,
          quantityPlanned: item.quantity,
          priority: order.priority,
          steps: { create: steps },
        },
      }),
    );
  }

  return pending.length;
}

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
}

/** Releases a planned work order to the shop floor (steps become queueable). */
export async function releaseWorkOrder(workOrderId: string): Promise<void> {
  const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) throw new NotFoundError("Ordem de fabrico não encontrada.");
  if (wo.status !== "planned") {
    throw new AppError("Esta ordem de fabrico já foi lançada.");
  }
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { status: "released" },
  });
}

/** Sets a work order's priority (used to bump urgent jobs up the queue). */
export async function setWorkOrderPriority(
  workOrderId: string,
  priority: "normal" | "urgent",
): Promise<void> {
  const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) throw new NotFoundError("Ordem de fabrico não encontrada.");
  if (wo.status === "done" || wo.status === "cancelled") {
    throw new AppError("Não é possível repriorizar uma ordem terminada.");
  }
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { priority },
  });
}

/**
 * Deletes a work order that has not started yet (planned only). Started or
 * finished work orders keep their history and must be cancelled instead.
 */
export async function deleteWorkOrder(workOrderId: string): Promise<void> {
  const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) throw new NotFoundError("Ordem de fabrico não encontrada.");
  if (wo.status !== "planned") {
    throw new AppError("Só pode eliminar ordens ainda por lançar. Cancele-a.");
  }
  await prisma.workOrder.delete({ where: { id: workOrderId } });
}

/** Cancels a work order, stopping any running step and rolling up the order. */
export async function cancelWorkOrder(workOrderId: string): Promise<void> {
  const now = new Date();
  const notify = await prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: { steps: true },
    });
    if (!wo) throw new NotFoundError("Ordem de fabrico não encontrada.");
    if (wo.status === "cancelled") {
      throw new AppError("Esta ordem de fabrico já está cancelada.");
    }
    if (wo.status === "done") {
      throw new AppError("Não é possível cancelar uma ordem concluída.");
    }

    // Bank time on any running step and freeze the steps.
    for (const step of wo.steps) {
      if (step.status === "in_progress") {
        await tx.workOrderStep.update({
          where: { id: step.id },
          data: {
            status: "paused",
            startedAt: null,
            actualMinutes:
              step.actualMinutes + elapsedMinutes(step.startedAt, now),
          },
        });
      }
    }

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { status: "cancelled", finishedAt: now },
    });

    return applyOrderRollup(tx, wo.orderId, now);
  });

  await dispatchOrderNotification(notify);
}

/** Reopens a cancelled work order, restoring its status from its steps. */
export async function reopenWorkOrder(workOrderId: string): Promise<void> {
  const now = new Date();
  const notify = await prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: { steps: true },
    });
    if (!wo) throw new NotFoundError("Ordem de fabrico não encontrada.");
    if (wo.status !== "cancelled") {
      throw new AppError("A ordem de fabrico não está cancelada.");
    }

    const restored = rollUpWorkOrderStatus("released", wo.steps);
    const woDone = restored === "done";
    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { status: restored, finishedAt: woDone ? now : null },
    });

    return applyOrderRollup(tx, wo.orderId, now);
  });

  await dispatchOrderNotification(notify);
}

// ── Shop-floor execution ────────────────────────────────────────────────────

/** Starts (or resumes) a step, stamping the operator and run interval. */
export async function startStep(
  operator: OperatorActor,
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
        operatorId: operator.id,
      },
    });

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
}

/** Completes a step, recording good/scrap quantities and rolling up state. */
export async function completeStep(
  operator: OperatorActor,
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
    if (!canCompleteStep(step.status)) {
      throw new AppError("Este passo não pode ser concluído.");
    }

    const wo = step.workOrder;
    await tx.workOrderStep.update({
      where: { id: input.stepId },
      data: {
        status: "done",
        finishedAt: now,
        startedAt: null,
        actualMinutes: step.actualMinutes + elapsedMinutes(step.startedAt, now),
        quantityDone: input.quantityDone,
        scrapQty: input.scrapQty,
        operatorId: operator.id,
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
          operatorId: operator.id,
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
        quantityDone: woDone ? input.quantityDone : wo.quantityDone,
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
}

// ── Internal helpers ────────────────────────────────────────────────────────

interface OrderNotification {
  companyId: string;
  reference: string;
  orderId: string;
  status: keyof typeof ORDER_STATUS_LABELS;
}

interface StageNotification {
  companyId: string;
  reference: string;
  orderId: string;
  stageLabel: string;
}

/**
 * Recomputes an order's status from its work orders inside the given
 * transaction. Returns the notification payload when the status changed, or
 * null. Kept transaction-local so the rollup is atomic with the step update.
 */
async function applyOrderRollup(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId: string,
  now = new Date(),
): Promise<OrderNotification | null> {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  const workOrders = await tx.workOrder.findMany({
    where: { orderId },
    select: { status: true },
  });
  const next = deriveOrderStatusFromProduction(order.status, workOrders);
  if (!next) return null;

  const dates = computeStatusDates(next, order, now);
  await tx.order.update({
    where: { id: orderId },
    data: { status: next, ...dates },
  });

  return {
    companyId: order.companyId,
    reference: order.reference,
    orderId: order.id,
    status: next,
  };
}

/** Best-effort client notification when production advances an order's stage. */
async function dispatchOrderNotification(
  notify: OrderNotification | null,
): Promise<void> {
  if (!notify) return;
  await notifyCompanyClients(notify.companyId, {
    type: "PRODUCTION_UPDATE",
    title: `Encomenda ${notify.reference}`,
    body: `A sua encomenda avançou para: ${ORDER_STATUS_LABELS[notify.status]}.`,
    href: `/dashboard/ordens/${notify.orderId}`,
  });
}

/** Best-effort client notification when a client-facing stage is completed. */
async function dispatchStageNotification(
  notify: StageNotification | null,
): Promise<void> {
  if (!notify) return;
  await notifyCompanyClients(notify.companyId, {
    type: "PRODUCTION_UPDATE",
    title: `Encomenda ${notify.reference}`,
    body: `Fase concluída: ${notify.stageLabel}.`,
    href: `/dashboard/ordens/${notify.orderId}`,
  });
}
