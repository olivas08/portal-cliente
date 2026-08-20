import { AppError } from "@/lib/errors";
import { round3, type TxClient } from "@/services/production/shared";

/**
 * FIFO batch consumption + the return path used by the work-order lifecycle
 * (release/reopen/cancel). Extracted here because both the initial
 * `releaseWorkOrder` issuance and `reopenWorkOrder`'s re-issuance run the
 * identical logic — this is the single place it's implemented.
 */

export interface IssuableMaterial {
  id: string; // WorkOrderMaterial id
  materialId: string;
  requiredQty: number;
  material: { tracksBatches: boolean };
}

export interface ReturnableMaterial {
  id: string; // WorkOrderMaterial id
  materialId: string;
  issuedQty: number;
}

/**
 * Issues each required material's full quantity: decrements the material's
 * aggregate stock, snapshots `issuedQty`, and logs the movement. For
 * `tracksBatches` materials, draws from `MaterialBatch` rows FIFO (oldest
 * `receivedAt` first) instead of a single untracked movement, recording each
 * portion in `WorkOrderMaterialBatch` — that ledger is what later lets an
 * order's traceability view point back to the exact supplier certificate.
 */
export async function issueMaterialsForWorkOrder(
  tx: TxClient,
  workOrderId: string,
  materials: IssuableMaterial[],
  note: string,
): Promise<void> {
  for (const m of materials) {
    if (m.requiredQty <= 0) continue;

    await tx.material.update({
      where: { id: m.materialId },
      data: { stockQty: { decrement: m.requiredQty } },
    });
    await tx.workOrderMaterial.update({
      where: { id: m.id },
      data: { issuedQty: m.requiredQty },
    });

    if (m.material.tracksBatches) {
      await consumeBatchesFifo(tx, m.materialId, m.id, m.requiredQty, workOrderId, note);
    } else {
      await tx.stockMovement.create({
        data: {
          materialId: m.materialId,
          delta: -m.requiredQty,
          reason: "issue",
          workOrderId,
          note,
        },
      });
    }
  }
}

async function consumeBatchesFifo(
  tx: TxClient,
  materialId: string,
  workOrderMaterialId: string,
  qtyNeeded: number,
  workOrderId: string,
  note: string,
): Promise<void> {
  const batches = await tx.materialBatch.findMany({
    where: { materialId, remainingQty: { gt: 0 } },
    orderBy: { receivedAt: "asc" },
  });

  let remaining = qtyNeeded;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = round3(Math.min(batch.remainingQty, remaining));
    if (take <= 0) continue;

    await tx.materialBatch.update({
      where: { id: batch.id },
      data: { remainingQty: { decrement: take } },
    });
    await tx.workOrderMaterialBatch.create({
      data: { workOrderMaterialId, materialBatchId: batch.id, qty: take },
    });
    await tx.stockMovement.create({
      data: {
        materialId,
        delta: -take,
        reason: "issue",
        workOrderId,
        materialBatchId: batch.id,
        note: `${note} (lote ${batch.batchCode})`,
      },
    });
    remaining = round3(remaining - take);
  }

  if (remaining > 0.001) {
    throw new AppError(
      `Stock por lote insuficiente para cobrir a requisição (faltam ${remaining}). Verifique a receção de lotes deste material.`,
    );
  }
}

/**
 * Reverses issuance on cancellation: returns the aggregate stock and, for
 * batch-tracked materials, credits back the exact batches this work order
 * had drawn from (via the `WorkOrderMaterialBatch` ledger) before clearing
 * those ledger rows — the work order no longer holds any batch allocation.
 */
export async function returnMaterialsForWorkOrder(
  tx: TxClient,
  workOrderId: string,
  materials: ReturnableMaterial[],
  note: string,
): Promise<void> {
  for (const m of materials) {
    if (m.issuedQty <= 0) continue;

    await tx.material.update({
      where: { id: m.materialId },
      data: { stockQty: { increment: m.issuedQty } },
    });

    const consumed = await tx.workOrderMaterialBatch.findMany({
      where: { workOrderMaterialId: m.id },
    });
    if (consumed.length > 0) {
      for (const c of consumed) {
        await tx.materialBatch.update({
          where: { id: c.materialBatchId },
          data: { remainingQty: { increment: c.qty } },
        });
        await tx.stockMovement.create({
          data: {
            materialId: m.materialId,
            delta: c.qty,
            reason: "return",
            workOrderId,
            materialBatchId: c.materialBatchId,
            note,
          },
        });
      }
      await tx.workOrderMaterialBatch.deleteMany({
        where: { workOrderMaterialId: m.id },
      });
    } else {
      await tx.stockMovement.create({
        data: {
          materialId: m.materialId,
          delta: m.issuedQty,
          reason: "return",
          workOrderId,
          note,
        },
      });
    }

    await tx.workOrderMaterial.update({
      where: { id: m.id },
      data: { issuedQty: 0 },
    });
  }
}
