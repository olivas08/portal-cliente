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

export const generateWorkOrdersSchema = z.object({
  orderId: z.string().trim().min(1, "Encomenda obrigatória."),
});

export const workOrderIdSchema = z.object({
  workOrderId: z.string().trim().min(1, "Ordem de fabrico obrigatória."),
});

export const stepIdSchema = z.object({
  stepId: z.string().trim().min(1, "Passo obrigatório."),
});

export const completeStepSchema = z.object({
  stepId: z.string().trim().min(1, "Passo obrigatório."),
  quantityDone: z.coerce.number().nonnegative("Quantidade inválida."),
  scrapQty: z.coerce.number().nonnegative("Sucata inválida.").default(0),
});
export type CompleteStepInput = z.infer<typeof completeStepSchema>;

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

  const workstations = await prisma.workstation.findMany({
    where: { active: true },
    orderBy: { sequence: "asc" },
  });
  if (workstations.length === 0) {
    throw new AppError("Configure pelo menos um posto de trabalho.");
  }

  const pending = order.items.filter((item) => item.workOrders.length === 0);
  if (pending.length === 0) {
    throw new AppError("Esta encomenda já tem produção planeada.");
  }

  for (const item of pending) {
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
          steps: {
            create: workstations.map((ws, index) => ({
              sequence: index + 1,
              name: ws.name,
              workstationId: ws.id,
              plannedMinutes: DEFAULT_STEP_MINUTES,
            })),
          },
        },
      }),
    );
  }

  return pending.length;
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
    if (!canStartStep(step.status)) {
      throw new AppError("Este passo já está em curso ou concluído.");
    }
    if (!isStepReady(step, wo.steps)) {
      throw new AppError("Conclua primeiro os passos anteriores.");
    }

    await tx.workOrderStep.update({
      where: { id: stepId },
      data: { status: "in_progress", startedAt: now, operatorId: operator.id },
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
      include: { workOrder: { include: { steps: true, order: true } } },
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

    return applyOrderRollup(tx, wo.orderId, now);
  });

  await dispatchOrderNotification(notify);
}

// ── Internal helpers ────────────────────────────────────────────────────────

interface OrderNotification {
  companyId: string;
  reference: string;
  orderId: string;
  status: keyof typeof ORDER_STATUS_LABELS;
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
