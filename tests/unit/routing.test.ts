import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    workOrderStep: { findUnique: vi.fn(), update: vi.fn() },
    workOrder: { update: vi.fn(), findUnique: vi.fn() },
    nonConformity: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import {
  startStep,
  pauseStep,
  resolveNonConformity,
  completeWorkOrderFromOffice,
} from "@/services/production/routing.service";

const operator = { id: "op1", name: "Carlos" };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock),
  );
});

describe("startStep", () => {
  it("rejects a missing step", async () => {
    prismaMock.workOrderStep.findUnique.mockResolvedValue(null);
    await expect(startStep(operator, "s-missing")).rejects.toThrow(
      "Passo não encontrado.",
    );
  });

  it("rejects a planned work order that has not been released", async () => {
    prismaMock.workOrderStep.findUnique.mockResolvedValue({
      id: "s1",
      status: "pending",
      workstationId: "ws1",
      workOrder: { id: "wo1", status: "planned", steps: [], order: {} },
    });
    await expect(startStep(operator, "s1")).rejects.toThrow(/Lance a ordem/);
  });
});

describe("pauseStep", () => {
  it("rejects pausing a step that is not in progress", async () => {
    prismaMock.workOrderStep.findUnique.mockResolvedValue({
      id: "s1",
      status: "pending",
    });
    await expect(pauseStep(operator, "s1")).rejects.toThrow(/pausar/);
  });
});

describe("resolveNonConformity", () => {
  it("rejects a missing NC", async () => {
    prismaMock.nonConformity.findUnique.mockResolvedValue(null);
    await expect(resolveNonConformity("nc-missing")).rejects.toThrow(
      "Não-conformidade não encontrada.",
    );
  });
});

describe("completeWorkOrderFromOffice", () => {
  it("rejects a missing work order", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(null);
    await expect(completeWorkOrderFromOffice("wo-missing")).rejects.toThrow(
      "Ordem de fabrico não encontrada.",
    );
  });

  it("rejects a work order that is still planned", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue({
      id: "wo1",
      status: "planned",
      steps: [],
    });
    await expect(completeWorkOrderFromOffice("wo1")).rejects.toThrow(
      /Lance a ordem/,
    );
  });
});
