import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockAuth, prismaMock } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  prismaMock: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateOrderStatus, createOrder } from "@/actions/orders";

const adminSession = { user: { role: "ADMIN", id: "u1", name: "Admin" } };
const clientSession = {
  user: { role: "CLIENT", id: "u2", companyId: "c1", name: "Cliente" },
};

const existingOrder = {
  id: "o1",
  status: "production",
  shippedDate: new Date("2026-06-18"),
  deliveredDate: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findUnique.mockResolvedValue(existingOrder);
  prismaMock.order.update.mockResolvedValue({});
  prismaMock.company.findUnique.mockResolvedValue({ id: "c1", name: "Auto Peças Mota" });
  prismaMock.order.count.mockResolvedValue(0);
  prismaMock.order.create.mockResolvedValue({ id: "o-new" });
});

describe("updateOrderStatus — authorization", () => {
  it("rejects a client", async () => {
    mockAuth.mockResolvedValue(clientSession);
    await expect(updateOrderStatus("o1", "shipped")).rejects.toThrow(
      "Não autorizado."
    );
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(updateOrderStatus("o1", "shipped")).rejects.toThrow(
      "Não autorizado."
    );
  });
});

describe("updateOrderStatus — validation", () => {
  it("rejects an invalid status value", async () => {
    mockAuth.mockResolvedValue(adminSession);
    await expect(updateOrderStatus("o1", "bogus" as never)).rejects.toThrow();
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("throws when the order does not exist", async () => {
    mockAuth.mockResolvedValue(adminSession);
    prismaMock.order.findUnique.mockResolvedValue(null);
    await expect(updateOrderStatus("missing", "shipped")).rejects.toThrow(
      "Encomenda não encontrada."
    );
  });
});

describe("updateOrderStatus — status transitions", () => {
  beforeEach(() => mockAuth.mockResolvedValue(adminSession));

  it("sets shippedDate and clears deliveredDate when shipped", async () => {
    await updateOrderStatus("o1", "shipped");
    const data = prismaMock.order.update.mock.calls[0][0].data;
    expect(data.status).toBe("shipped");
    expect(data.shippedDate).toBeInstanceOf(Date);
    expect(data.deliveredDate).toBeNull();
  });

  it("sets deliveredDate and preserves shippedDate when delivered", async () => {
    await updateOrderStatus("o1", "delivered");
    const data = prismaMock.order.update.mock.calls[0][0].data;
    expect(data.status).toBe("delivered");
    expect(data.deliveredDate).toBeInstanceOf(Date);
    expect(data.shippedDate).toBe(existingOrder.shippedDate);
  });

  it("clears both dates when moved back to production", async () => {
    await updateOrderStatus("o1", "production");
    const data = prismaMock.order.update.mock.calls[0][0].data;
    expect(data.status).toBe("production");
    expect(data.shippedDate).toBeNull();
    expect(data.deliveredDate).toBeNull();
  });
});

const validOrderInput = {
  companyId: "c1",
  batchNumber: "LT-2026-090",
  expectedDate: "2026-08-01",
  items: [
    { reference: "REF-1", description: "Peça X", quantity: 10, unit: "un", unitPriceEur: 2.5 },
  ],
};

describe("createOrder — authorization", () => {
  it("rejects a client", async () => {
    mockAuth.mockResolvedValue(clientSession);
    await expect(createOrder(validOrderInput)).rejects.toThrow("Não autorizado.");
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(createOrder(validOrderInput)).rejects.toThrow("Não autorizado.");
  });
});

describe("createOrder — validation", () => {
  beforeEach(() => mockAuth.mockResolvedValue(adminSession));

  it("throws when the company does not exist", async () => {
    prismaMock.company.findUnique.mockResolvedValue(null);
    await expect(createOrder(validOrderInput)).rejects.toThrow(
      "Cliente não encontrado."
    );
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects an order with no items", async () => {
    await expect(
      createOrder({ ...validOrderInput, items: [] })
    ).rejects.toThrow();
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive quantity", async () => {
    await expect(
      createOrder({
        ...validOrderInput,
        items: [{ ...validOrderInput.items[0], quantity: 0 }],
      })
    ).rejects.toThrow();
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });
});

describe("createOrder — reference generation", () => {
  beforeEach(() => mockAuth.mockResolvedValue(adminSession));

  it("generates the first reference of the year", async () => {
    prismaMock.order.count.mockResolvedValue(0);
    await createOrder(validOrderInput);
    const year = new Date().getFullYear();
    const data = prismaMock.order.create.mock.calls[0][0].data;
    expect(data.reference).toBe(`ENC-${year}-001`);
  });

  it("increments the sequence based on existing count", async () => {
    prismaMock.order.count.mockResolvedValue(41);
    await createOrder(validOrderInput);
    const year = new Date().getFullYear();
    const data = prismaMock.order.create.mock.calls[0][0].data;
    expect(data.reference).toBe(`ENC-${year}-042`);
  });

  it("creates nested items with the given values", async () => {
    await createOrder(validOrderInput);
    const data = prismaMock.order.create.mock.calls[0][0].data;
    expect(data.items.create).toEqual([
      { reference: "REF-1", description: "Peça X", quantity: 10, unit: "un", unitPriceEur: 2.5 },
    ]);
  });

  it("returns the new order id", async () => {
    prismaMock.order.create.mockResolvedValue({ id: "o-created" });
    const id = await createOrder(validOrderInput);
    expect(id).toBe("o-created");
  });
});
