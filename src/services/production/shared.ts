import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import { computeStatusDates } from "@/services/order-status";
import { notifyCompanyClients } from "@/services/notifications.service";
import { deriveOrderStatusFromProduction } from "@/services/production-status";

/**
 * Small building blocks shared across the production sub-domains
 * (operators, machines, work-orders, routing/execution) — kept here instead
 * of duplicated so each domain file only owns its own concern.
 */

export const PIN_SALT_ROUNDS = 10;

export const DEFAULT_STEP_MINUTES = 30;

/** Rounds to 3 decimals to avoid float noise in stock/material quantities. */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface OrderNotification {
  companyId: string;
  reference: string;
  orderId: string;
  status: keyof typeof ORDER_STATUS_LABELS;
}

export interface StageNotification {
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
export async function applyOrderRollup(
  tx: TxClient,
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
export async function dispatchOrderNotification(
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
export async function dispatchStageNotification(
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
