import { describe, it, expect, vi } from "vitest";
import {
  issueMaterialsForWorkOrder,
  returnMaterialsForWorkOrder,
  type IssuableMaterial,
  type ReturnableMaterial,
} from "@/services/production/material-issuance";
import { AppError } from "@/lib/errors";

/**
 * Minimal fake of the Prisma interactive-transaction client, covering only
 * the delegate methods `material-issuance.ts` calls. Batches are seeded
 * directly into `materialBatch.findMany`'s backing array so FIFO ordering
 * behaviour can be asserted end-to-end without a real database.
 */
function makeTx(batches: { id: string; remainingQty: number; batchCode: string; receivedAt: Date }[] = []) {
  const state = {
    batches: batches.map((b) => ({ ...b })),
    ledger: [] as { id: string; workOrderMaterialId: string; materialBatchId: string; qty: number }[],
  };
  let ledgerSeq = 0;

  const tx = {
    material: { update: vi.fn().mockResolvedValue({}) },
    workOrderMaterial: { update: vi.fn().mockResolvedValue({}) },
    stockMovement: { create: vi.fn().mockResolvedValue({}) },
    materialBatch: {
      findMany: vi.fn(async ({ where }: { where: { materialId: string; remainingQty?: { gt: number } } }) =>
        state.batches
          .filter((b) => b.remainingQty > (where.remainingQty?.gt ?? -Infinity))
          .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()),
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { remainingQty: { decrement?: number; increment?: number } } }) => {
        const batch = state.batches.find((b) => b.id === where.id)!;
        if (data.remainingQty.decrement !== undefined) batch.remainingQty -= data.remainingQty.decrement;
        if (data.remainingQty.increment !== undefined) batch.remainingQty += data.remainingQty.increment;
        return batch;
      }),
    },
    workOrderMaterialBatch: {
      create: vi.fn(async ({ data }: { data: { workOrderMaterialId: string; materialBatchId: string; qty: number } }) => {
        const row = { id: `ledger-${++ledgerSeq}`, ...data };
        state.ledger.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }: { where: { workOrderMaterialId: string } }) =>
        state.ledger.filter((l) => l.workOrderMaterialId === where.workOrderMaterialId),
      ),
      deleteMany: vi.fn(async ({ where }: { where: { workOrderMaterialId: string } }) => {
        const before = state.ledger.length;
        state.ledger = state.ledger.filter((l) => l.workOrderMaterialId !== where.workOrderMaterialId);
        return { count: before - state.ledger.length };
      }),
    },
  };

  return { tx: tx as unknown as Parameters<typeof issueMaterialsForWorkOrder>[0], state };
}

describe("issueMaterialsForWorkOrder", () => {
  it("logs a plain movement for untracked materials without touching batches", async () => {
    const { tx } = makeTx();
    const materials: IssuableMaterial[] = [
      { id: "wm1", materialId: "mat1", requiredQty: 10, material: { tracksBatches: false } },
    ];
    await issueMaterialsForWorkOrder(tx, "wo1", materials, "Consumo OF X");

    expect(tx.material.update).toHaveBeenCalledWith({
      where: { id: "mat1" },
      data: { stockQty: { decrement: 10 } },
    });
    expect(tx.workOrderMaterial.update).toHaveBeenCalledWith({
      where: { id: "wm1" },
      data: { issuedQty: 10 },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: { materialId: "mat1", delta: -10, reason: "issue", workOrderId: "wo1", note: "Consumo OF X" },
    });
    expect(tx.materialBatch.findMany).not.toHaveBeenCalled();
  });

  it("skips zero/negative requirements entirely", async () => {
    const { tx } = makeTx();
    await issueMaterialsForWorkOrder(
      tx,
      "wo1",
      [{ id: "wm1", materialId: "mat1", requiredQty: 0, material: { tracksBatches: false } }],
      "note",
    );
    expect(tx.material.update).not.toHaveBeenCalled();
  });

  it("consumes a single batch fully when it covers the requirement", async () => {
    const { tx, state } = makeTx([
      { id: "b1", remainingQty: 50, batchCode: "HT-100", receivedAt: new Date("2024-01-01") },
    ]);
    const materials: IssuableMaterial[] = [
      { id: "wm1", materialId: "mat1", requiredQty: 20, material: { tracksBatches: true } },
    ];
    await issueMaterialsForWorkOrder(tx, "wo1", materials, "Consumo OF X");

    expect(state.batches[0].remainingQty).toBe(30);
    expect(state.ledger).toEqual([
      { id: "ledger-1", workOrderMaterialId: "wm1", materialBatchId: "b1", qty: 20 },
    ]);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        materialId: "mat1",
        delta: -20,
        reason: "issue",
        workOrderId: "wo1",
        materialBatchId: "b1",
        note: "Consumo OF X (lote HT-100)",
      },
    });
  });

  it("draws FIFO across multiple batches, oldest first, when one delivery isn't enough", async () => {
    const { tx, state } = makeTx([
      { id: "b-new", remainingQty: 100, batchCode: "HT-NEW", receivedAt: new Date("2024-03-01") },
      { id: "b-old", remainingQty: 15, batchCode: "HT-OLD", receivedAt: new Date("2024-01-01") },
    ]);
    const materials: IssuableMaterial[] = [
      { id: "wm1", materialId: "mat1", requiredQty: 20, material: { tracksBatches: true } },
    ];
    await issueMaterialsForWorkOrder(tx, "wo1", materials, "Consumo OF X");

    // Oldest batch (b-old, 15) drained first, remainder (5) from b-new.
    expect(state.batches.find((b) => b.id === "b-old")!.remainingQty).toBe(0);
    expect(state.batches.find((b) => b.id === "b-new")!.remainingQty).toBe(95);
    expect(state.ledger).toEqual([
      { id: "ledger-1", workOrderMaterialId: "wm1", materialBatchId: "b-old", qty: 15 },
      { id: "ledger-2", workOrderMaterialId: "wm1", materialBatchId: "b-new", qty: 5 },
    ]);
  });

  it("throws when the batches on hand can't cover the requirement", async () => {
    const { tx } = makeTx([
      { id: "b1", remainingQty: 5, batchCode: "HT-100", receivedAt: new Date("2024-01-01") },
    ]);
    const materials: IssuableMaterial[] = [
      { id: "wm1", materialId: "mat1", requiredQty: 20, material: { tracksBatches: true } },
    ];
    await expect(
      issueMaterialsForWorkOrder(tx, "wo1", materials, "Consumo OF X"),
    ).rejects.toThrow(AppError);
  });
});

describe("returnMaterialsForWorkOrder", () => {
  it("logs a plain return movement for untracked materials", async () => {
    const { tx } = makeTx();
    const materials: ReturnableMaterial[] = [
      { id: "wm1", materialId: "mat1", issuedQty: 10 },
    ];
    await returnMaterialsForWorkOrder(tx, "wo1", materials, "Devolução OF X");

    expect(tx.material.update).toHaveBeenCalledWith({
      where: { id: "mat1" },
      data: { stockQty: { increment: 10 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: { materialId: "mat1", delta: 10, reason: "return", workOrderId: "wo1", note: "Devolução OF X" },
    });
    expect(tx.workOrderMaterial.update).toHaveBeenCalledWith({
      where: { id: "wm1" },
      data: { issuedQty: 0 },
    });
  });

  it("skips materials that were never issued", async () => {
    const { tx } = makeTx();
    await returnMaterialsForWorkOrder(
      tx,
      "wo1",
      [{ id: "wm1", materialId: "mat1", issuedQty: 0 }],
      "note",
    );
    expect(tx.material.update).not.toHaveBeenCalled();
  });

  it("credits the exact batches back via the ledger and clears it", async () => {
    const { tx, state } = makeTx([
      { id: "b-old", remainingQty: 0, batchCode: "HT-OLD", receivedAt: new Date("2024-01-01") },
      { id: "b-new", remainingQty: 95, batchCode: "HT-NEW", receivedAt: new Date("2024-03-01") },
    ]);
    state.ledger.push(
      { id: "l1", workOrderMaterialId: "wm1", materialBatchId: "b-old", qty: 15 },
      { id: "l2", workOrderMaterialId: "wm1", materialBatchId: "b-new", qty: 5 },
    );
    const materials: ReturnableMaterial[] = [
      { id: "wm1", materialId: "mat1", issuedQty: 20 },
    ];
    await returnMaterialsForWorkOrder(tx, "wo1", materials, "Devolução OF X");

    expect(state.batches.find((b) => b.id === "b-old")!.remainingQty).toBe(15);
    expect(state.batches.find((b) => b.id === "b-new")!.remainingQty).toBe(100);
    expect(state.ledger).toEqual([]);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        materialId: "mat1",
        delta: 15,
        reason: "return",
        workOrderId: "wo1",
        materialBatchId: "b-old",
        note: "Devolução OF X",
      },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        materialId: "mat1",
        delta: 5,
        reason: "return",
        workOrderId: "wo1",
        materialBatchId: "b-new",
        note: "Devolução OF X",
      },
    });
  });
});
