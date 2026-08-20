import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { NotFoundError, AppError } from "@/lib/errors";
import { createWithReference } from "@/services/reference.service";
import { elapsedMinutes, computeShortfalls, rollUpWorkOrderStatus } from "@/services/production-status";
import {
  round3,
  DEFAULT_STEP_MINUTES,
  applyOrderRollup,
  dispatchOrderNotification,
} from "@/services/production/shared";
import {
  issueMaterialsForWorkOrder,
  returnMaterialsForWorkOrder,
} from "@/services/production/material-issuance";

// ── Schemas ─────────────────────────────────────────────────────────────────

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
    include: {
      routing: { orderBy: { sequence: "asc" } },
      bom: { include: { material: true } },
    },
  });
  const routingByRef = new Map(products.map((p) => [p.reference, p.routing]));
  const bomByRef = new Map(products.map((p) => [p.reference, p.bom]));

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

    const bom = bomByRef.get(item.reference) ?? [];
    const materials = bom.map((b) => ({
      materialId: b.materialId,
      materialRef: b.material.reference,
      materialName: b.material.name,
      unit: b.material.unit,
      requiredQty: b.qtyPerUnit * item.quantity,
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
          materials: materials.length > 0 ? { create: materials } : undefined,
        },
      }),
    );
  }

  invalidateCache(CACHE_TAGS.workOrders);
  return pending.length;
}

/** Releases a planned work order to the shop floor (steps become queueable). */
export async function releaseWorkOrder(workOrderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: { materials: { include: { material: true } } },
    });
    if (!wo) throw new NotFoundError("Ordem de fabrico não encontrada.");
    if (wo.status !== "planned") {
      throw new AppError("Esta ordem de fabrico já foi lançada.");
    }

    // Gate: verify every required material is in stock before releasing.
    const shortfalls = computeShortfalls(
      wo.materials.map((m) => ({
        materialId: m.materialId,
        materialRef: m.materialRef,
        materialName: m.materialName,
        unit: m.unit,
        requiredQty: m.requiredQty,
        availableQty: m.material.stockQty,
      })),
    );
    if (shortfalls.length > 0) {
      const detail = shortfalls
        .map(
          (s) =>
            `${s.materialRef} (${s.materialName}): faltam ${round3(
              s.missingQty,
            )} ${s.unit}`,
        )
        .join("; ");
      throw new AppError(
        `Stock insuficiente para lançar esta ordem de fabrico. ${detail}.`,
      );
    }

    // Reserve/issue the materials: decrement stock, snapshot issued qty and
    // log a movement for the audit trail (per-batch when the material is
    // batch-tracked, so this is where traceability begins).
    await issueMaterialsForWorkOrder(
      tx,
      wo.id,
      wo.materials.map((m) => ({
        id: m.id,
        materialId: m.materialId,
        requiredQty: m.requiredQty,
        material: { tracksBatches: m.material.tracksBatches },
      })),
      `Consumo OF ${wo.reference}`,
    );

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { status: "released" },
    });
  });
  invalidateCache(CACHE_TAGS.workOrders);
  invalidateCache(CACHE_TAGS.materials);
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
  invalidateCache(CACHE_TAGS.workOrders);
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
  invalidateCache(CACHE_TAGS.workOrders);
}

/** Cancels a work order, stopping any running step and rolling up the order. */
export async function cancelWorkOrder(workOrderId: string): Promise<void> {
  const now = new Date();
  const notify = await prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: { steps: true, materials: true },
    });
    if (!wo) throw new NotFoundError("Ordem de fabrico não encontrada.");
    if (wo.status === "cancelled") {
      throw new AppError("Esta ordem de fabrico já está cancelada.");
    }
    if (wo.status === "done") {
      throw new AppError("Não é possível cancelar uma ordem concluída.");
    }

    // Return any materials that were issued at release back to stock (and,
    // for batch-tracked materials, back to the exact batches they came from).
    await returnMaterialsForWorkOrder(
      tx,
      wo.id,
      wo.materials.map((m) => ({
        id: m.id,
        materialId: m.materialId,
        issuedQty: m.issuedQty,
      })),
      `Devolução por cancelamento OF ${wo.reference}`,
    );

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
  invalidateCache(CACHE_TAGS.workOrders);
  invalidateCache(CACHE_TAGS.materials);
}

/** Reopens a cancelled work order, restoring its status from its steps. */
export async function reopenWorkOrder(workOrderId: string): Promise<void> {
  const now = new Date();
  const notify = await prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: { steps: true, materials: { include: { material: true } } },
    });
    if (!wo) throw new NotFoundError("Ordem de fabrico não encontrada.");
    if (wo.status !== "cancelled") {
      throw new AppError("A ordem de fabrico não está cancelada.");
    }

    // Re-issue the materials that were returned to stock on cancellation,
    // applying the same stock gate as a fresh release.
    const shortfalls = computeShortfalls(
      wo.materials.map((m) => ({
        materialId: m.materialId,
        materialRef: m.materialRef,
        materialName: m.materialName,
        unit: m.unit,
        requiredQty: m.requiredQty,
        availableQty: m.material.stockQty,
      })),
    );
    if (shortfalls.length > 0) {
      const detail = shortfalls
        .map(
          (s) =>
            `${s.materialRef} (${s.materialName}): faltam ${round3(
              s.missingQty,
            )} ${s.unit}`,
        )
        .join("; ");
      throw new AppError(
        `Stock insuficiente para reabrir esta ordem de fabrico. ${detail}.`,
      );
    }
    await issueMaterialsForWorkOrder(
      tx,
      wo.id,
      wo.materials.map((m) => ({
        id: m.id,
        materialId: m.materialId,
        requiredQty: m.requiredQty,
        material: { tracksBatches: m.material.tracksBatches },
      })),
      `Reemissão por reabertura OF ${wo.reference}`,
    );

    const restored = rollUpWorkOrderStatus("released", wo.steps);
    const woDone = restored === "done";
    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { status: restored, finishedAt: woDone ? now : null },
    });

    return applyOrderRollup(tx, wo.orderId, now);
  });

  await dispatchOrderNotification(notify);
  invalidateCache(CACHE_TAGS.workOrders);
  invalidateCache(CACHE_TAGS.materials);
}
