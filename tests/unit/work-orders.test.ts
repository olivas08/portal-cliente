import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    workOrder: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    order: { findUnique: vi.fn() },
    workstation: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/services/production/material-issuance", () => ({
  issueMaterialsForWorkOrder: vi.fn(),
  returnMaterialsForWorkOrder: vi.fn(),
}));

import {
  generateWorkOrdersForOrder,
  releaseWorkOrder,
  setWorkOrderPriority,
} from "@/services/production/work-orders.service";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock),
  );
});

describe("generateWorkOrdersForOrder", () => {
  it("rejects a missing order", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    await expect(generateWorkOrdersForOrder("missing")).rejects.toThrow(
      "Encomenda não encontrada.",
    );
  });

  it("rejects a cancelled order", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "o1",
      status: "cancelled",
      items: [],
    });
    await expect(generateWorkOrdersForOrder("o1")).rejects.toThrow(
      /encomenda cancelada/,
    );
  });

  it("rejects when every line already has a work order", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "o1",
      status: "pending",
      items: [{ id: "i1", workOrders: [{ id: "wo1" }] }],
    });
    prismaMock.workstation.findMany.mockResolvedValue([{ id: "ws1", name: "Corte", sequence: 1 }]);
    await expect(generateWorkOrdersForOrder("o1")).rejects.toThrow(
      /já tem produção planeada/,
    );
  });
});

describe("releaseWorkOrder", () => {
  it("rejects a missing work order", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(null);
    await expect(releaseWorkOrder("wo-missing")).rejects.toThrow(
      "Ordem de fabrico não encontrada.",
    );
  });

  it("rejects a work order that is no longer planned", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue({
      id: "wo1",
      status: "released",
      materials: [],
    });
    await expect(releaseWorkOrder("wo1")).rejects.toThrow(/já foi lançada/);
  });

  it("rejects when required stock is short", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue({
      id: "wo1",
      reference: "OF-1",
      status: "planned",
      materials: [
        {
          id: "wom1",
          materialId: "mat1",
          materialRef: "ACO",
          materialName: "Aço",
          unit: "kg",
          requiredQty: 10,
          material: { stockQty: 2, tracksBatches: false },
        },
      ],
    });
    await expect(releaseWorkOrder("wo1")).rejects.toThrow(/Stock insuficiente/);
  });
});

describe("setWorkOrderPriority", () => {
  it("rejects a finished work order", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue({
      id: "wo1",
      status: "done",
    });
    await expect(setWorkOrderPriority("wo1", "urgent")).rejects.toThrow(
      /repriorizar/,
    );
  });
});
