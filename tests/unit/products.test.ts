import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockAuth, prismaMock } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  prismaMock: {
    product: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    productPrice: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    order: { create: vi.fn(), count: vi.fn() },
    company: { findUnique: vi.fn() },
    user: { findMany: vi.fn(() => Promise.resolve([])) },
    notification: { createMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import {
  createProduct,
  updateProduct,
  setProductActive,
  placeCatalogOrder,
} from "@/actions/products";

const admin = { user: { role: "ADMIN", id: "a1", name: "Sofia" } };
const client = {
  user: { role: "CLIENT", id: "u1", companyId: "c1", name: "Jorge" },
};

const baseProductInput = {
  reference: "PAR-M8",
  name: "Parafuso M8",
  description: "Parafuso métrico",
  unit: "un",
  unitPriceEur: 0.35,
  category: "Fixação",
  imageUrl: "",
  active: true,
  companyPrices: [{ companyId: "c1", unitPriceEur: 0.31 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(admin);
  prismaMock.product.create.mockResolvedValue({ id: "p-new" });
  prismaMock.product.update.mockResolvedValue({});
  prismaMock.product.findUnique.mockResolvedValue({ id: "p1" });
  prismaMock.productPrice.deleteMany.mockResolvedValue({});
  prismaMock.productPrice.createMany.mockResolvedValue({});
  prismaMock.order.create.mockResolvedValue({ id: "o-new", reference: "ENC-2026-009" });
  prismaMock.order.count.mockResolvedValue(8);
  prismaMock.company.findUnique.mockResolvedValue({ id: "c1", name: "Mota" });
});

describe("createProduct — authorization", () => {
  it("rejects a client", async () => {
    mockAuth.mockResolvedValue(client);
    await expect(createProduct(baseProductInput)).rejects.toThrow("Não autorizado.");
    expect(prismaMock.product.create).not.toHaveBeenCalled();
  });
});

describe("createProduct — creation", () => {
  it("normalizes empty imageUrl/category to null and nests company prices", async () => {
    await createProduct({ ...baseProductInput, imageUrl: "", category: "" });
    const data = prismaMock.product.create.mock.calls[0][0].data;
    expect(data.imageUrl).toBeNull();
    expect(data.category).toBeNull();
    expect(data.prices.create).toEqual([{ companyId: "c1", unitPriceEur: 0.31 }]);
  });

  it("maps a duplicate-reference DB error to a friendly message", async () => {
    prismaMock.product.create.mockRejectedValue({ code: "P2002" });
    await expect(createProduct(baseProductInput)).rejects.toThrow(
      "Já existe um produto com essa referência.",
    );
  });

  it("accepts an uploaded image as a base64 data URL", async () => {
    const dataUrl =
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==";
    await createProduct({ ...baseProductInput, imageUrl: dataUrl });
    const data = prismaMock.product.create.mock.calls[0][0].data;
    expect(data.imageUrl).toBe(dataUrl);
  });

  it("rejects an image value that is neither a URL nor an image data URL", async () => {
    await expect(
      createProduct({ ...baseProductInput, imageUrl: "not-an-image" }),
    ).rejects.toThrow("Imagem inválida.");
    expect(prismaMock.product.create).not.toHaveBeenCalled();
  });
});

describe("updateProduct — overrides replacement", () => {
  it("replaces the per-company prices (delete then recreate)", async () => {
    await updateProduct("p1", baseProductInput);
    expect(prismaMock.productPrice.deleteMany).toHaveBeenCalledWith({
      where: { productId: "p1" },
    });
    const createArg = prismaMock.productPrice.createMany.mock.calls[0][0];
    expect(createArg.data).toEqual([
      { companyId: "c1", unitPriceEur: 0.31, productId: "p1" },
    ]);
  });

  it("throws when the product does not exist", async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);
    await expect(updateProduct("ghost", baseProductInput)).rejects.toThrow(
      "Produto não encontrado.",
    );
  });
});

describe("setProductActive", () => {
  it("updates the active flag", async () => {
    await setProductActive("p1", false);
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { active: false },
    });
  });
});

describe("placeCatalogOrder — authorization", () => {
  const validOrder = {
    expectedDate: "2026-09-01",
    items: [{ productId: "p1", quantity: 10 }],
  };

  it("rejects an admin (catalog ordering is client self-service)", async () => {
    mockAuth.mockResolvedValue(admin);
    await expect(placeCatalogOrder(validOrder)).rejects.toThrow("Não autorizado.");
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });
});

describe("placeCatalogOrder — pricing and integrity", () => {
  const validOrder = {
    expectedDate: "2026-09-01",
    items: [
      { productId: "p1", quantity: 10 },
      { productId: "p2", quantity: 4 },
    ],
  };

  beforeEach(() => {
    mockAuth.mockResolvedValue(client);
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: "p1",
        reference: "PAR-M8",
        name: "Parafuso M8",
        unit: "un",
        unitPriceEur: 0.35,
        prices: [{ unitPriceEur: 0.31 }], // negotiated for c1
      },
      {
        id: "p2",
        reference: "POR-M8",
        name: "Porca M8",
        unit: "un",
        unitPriceEur: 0.18,
        prices: [], // falls back to base
      },
    ]);
  });

  it("only queries active products", async () => {
    await placeCatalogOrder(validOrder);
    const where = prismaMock.product.findMany.mock.calls[0][0].where;
    expect(where.active).toBe(true);
  });

  it("resolves the effective price server-side (override then base)", async () => {
    await placeCatalogOrder(validOrder);
    const data = prismaMock.order.create.mock.calls[0][0].data;
    expect(data.items.create).toEqual([
      { reference: "PAR-M8", description: "Parafuso M8", quantity: 10, unit: "un", unitPriceEur: 0.31 },
      { reference: "POR-M8", description: "Porca M8", quantity: 4, unit: "un", unitPriceEur: 0.18 },
    ]);
    expect(data.status).toBe("pending");
    expect(data.companyId).toBe("c1");
    expect(data.batchNumber).toBeNull();
  });

  it("rejects when a requested product is unavailable/inactive", async () => {
    prismaMock.product.findMany.mockResolvedValue([]); // none active
    await expect(placeCatalogOrder(validOrder)).rejects.toThrow(
      "Produto indisponível no catálogo.",
    );
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("returns the new order id", async () => {
    const id = await placeCatalogOrder(validOrder);
    expect(id).toBe("o-new");
  });
});
