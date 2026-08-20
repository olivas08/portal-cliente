import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    material: { findUnique: vi.fn(), update: vi.fn() },
    materialBatch: { create: vi.fn() },
    stockMovement: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
  };
  return { prismaMock };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import { receiveMaterialBatch, receiveStock } from "@/services/materials.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("receiveMaterialBatch", () => {
  it("throws when the material doesn't exist", async () => {
    prismaMock.material.findUnique.mockResolvedValue(null);
    await expect(
      receiveMaterialBatch({ materialId: "missing", batchCode: "HT-1", qty: 10 }),
    ).rejects.toThrow(/não encontrado/i);
  });

  it("throws when the material isn't configured for batch tracking", async () => {
    prismaMock.material.findUnique.mockResolvedValue({ id: "m1", tracksBatches: false });
    await expect(
      receiveMaterialBatch({ materialId: "m1", batchCode: "HT-1", qty: 10 }),
    ).rejects.toThrow(/não está configurado/i);
  });

  it("creates the batch, increments stock and logs a movement with the batch link", async () => {
    prismaMock.material.findUnique.mockResolvedValue({ id: "m1", tracksBatches: true });
    prismaMock.materialBatch.create.mockResolvedValue({ id: "batch-1" });

    await receiveMaterialBatch({
      materialId: "m1",
      batchCode: "HT-2024-118",
      qty: 500,
      supplierName: "Aços do Norte",
      certificateRef: "CERT-99",
    });

    expect(prismaMock.materialBatch.create).toHaveBeenCalledWith({
      data: {
        materialId: "m1",
        batchCode: "HT-2024-118",
        supplierName: "Aços do Norte",
        certificateRef: "CERT-99",
        receivedQty: 500,
        remainingQty: 500,
        note: null,
      },
    });
    expect(prismaMock.material.findUnique).toHaveBeenCalled();
    expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
      data: {
        materialId: "m1",
        delta: 500,
        reason: "receipt",
        materialBatchId: "batch-1",
        note: "Receção de lote HT-2024-118",
      },
    });
  });
});

describe("receiveStock", () => {
  it("rejects tracksBatches materials, pointing to receiveMaterialBatch instead", async () => {
    prismaMock.material.findUnique.mockResolvedValue({ id: "m1", tracksBatches: true });
    await expect(
      receiveStock({ materialId: "m1", qty: 10 }),
    ).rejects.toThrow(/rastreável por lote/i);
  });
});
