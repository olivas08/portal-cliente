import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockAuth, prismaMock } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  prismaMock: {
    material: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    stockMovement: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMockRef())),
  },
}));

// $transaction in the service is called with a callback (interactive
// transaction) — resolve it against the same mocked client.
function prismaMockRef() {
  return prismaMock;
}

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import { importMaterials } from "@/actions/materials";

const admin = { user: { role: "ADMIN", id: "a1", name: "Sofia" } };
const client = { user: { role: "CLIENT", id: "u1", companyId: "c1", name: "Jorge" } };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(admin);
  prismaMock.material.findMany.mockResolvedValue([]);
  prismaMock.material.create.mockResolvedValue({ id: "mat-new" });
});

describe("importMaterials action", () => {
  it("rejects non-admin users", async () => {
    mockAuth.mockResolvedValue(client);
    const res = await importMaterials([
      { reference: "MAT-001", name: "Chapa", unit: "kg", minStockQty: 0, initialQty: 0 },
    ]);
    expect(res).toMatchObject({ error: expect.any(String) });
    expect(prismaMock.material.create).not.toHaveBeenCalled();
  });

  it("creates new materials and logs an initial stock movement", async () => {
    const res = await importMaterials([
      { reference: "MAT-001", name: "Chapa inox", unit: "kg", minStockQty: 10, initialQty: 50 },
    ]);
    expect(res).toMatchObject({ created: 1, updated: 0, errors: [] });
    expect(prismaMock.material.create).toHaveBeenCalledWith({
      data: {
        reference: "MAT-001",
        name: "Chapa inox",
        unit: "kg",
        minStockQty: 10,
        stockQty: 50,
      },
    });
    expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
      data: {
        materialId: "mat-new",
        delta: 50,
        reason: "receipt",
        note: "Importação CSV",
      },
    });
  });

  it("does not create a stock movement when initialQty is 0", async () => {
    await importMaterials([
      { reference: "MAT-002", name: "Varão", unit: "m", minStockQty: 0, initialQty: 0 },
    ]);
    expect(prismaMock.stockMovement.create).not.toHaveBeenCalled();
  });

  it("updates master data of an existing material without touching stock", async () => {
    prismaMock.material.findMany.mockResolvedValue([
      { id: "mat-existing", reference: "MAT-003" },
    ]);
    const res = await importMaterials([
      { reference: "MAT-003", name: "Novo nome", unit: "kg", minStockQty: 5, initialQty: 999 },
    ]);
    expect(res).toMatchObject({ created: 0, updated: 1, errors: [] });
    expect(prismaMock.material.update).toHaveBeenCalledWith({
      where: { id: "mat-existing" },
      data: { name: "Novo nome", unit: "kg", minStockQty: 5 },
    });
    expect(prismaMock.material.create).not.toHaveBeenCalled();
    expect(prismaMock.stockMovement.create).not.toHaveBeenCalled();
  });

  it("reports duplicate references within the same file as row errors", async () => {
    const res = await importMaterials([
      { reference: "MAT-004", name: "Peça A", unit: "un", minStockQty: 0, initialQty: 0 },
      { reference: "MAT-004", name: "Peça B", unit: "un", minStockQty: 0, initialQty: 0 },
    ]);
    expect(res).toMatchObject({ created: 1, updated: 0 });
    expect((res as { errors: { message: string }[] }).errors).toHaveLength(1);
    expect((res as { errors: { message: string }[] }).errors[0].message).toMatch(
      /duplicada/i,
    );
  });

  it("rejects an empty batch via the zod schema", async () => {
    await expect(importMaterials([])).rejects.toThrow();
  });
});
