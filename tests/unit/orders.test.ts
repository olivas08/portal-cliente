import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockAuth, prismaMock, mockGetBaseUrl, mockSendOrderStatusUpdateEmail } = vi.hoisted(() => ({
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
    user: {
      findFirst: vi.fn(),
    },
  },
  mockGetBaseUrl: vi.fn(),
  mockSendOrderStatusUpdateEmail: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/url", () => ({ getBaseUrl: mockGetBaseUrl }));
vi.mock("@/lib/email", () => ({
  sendOrderStatusUpdateEmail: mockSendOrderStatusUpdateEmail,
}));

import { updateOrderStatus, createOrder, reorderOrder } from "@/actions/orders";

const adminSession = { user: { role: "ADMIN", id: "u1", name: "Admin" } };
const clientSession = {
  user: { role: "CLIENT", id: "u2", companyId: "c1", name: "Cliente" },
};

const existingOrder = {
  id: "o1",
  reference: "ENC-2026-001",
  companyId: "c1",
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
  prismaMock.user.findFirst.mockResolvedValue({
    id: "u2",
    email: "cliente@empresa.pt",
  });
  mockGetBaseUrl.mockResolvedValue("https://portal.example.com");
  mockSendOrderStatusUpdateEmail.mockResolvedValue(undefined);
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

describe("updateOrderStatus — client notification email", () => {
  beforeEach(() => mockAuth.mockResolvedValue(adminSession));

  it("emails the company's first CLIENT user with the new status", async () => {
    await updateOrderStatus("o1", "shipped");
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { companyId: "c1", role: "CLIENT" },
      orderBy: { createdAt: "asc" },
    });
    expect(mockSendOrderStatusUpdateEmail).toHaveBeenCalledWith(
      "cliente@empresa.pt",
      {
        reference: "ENC-2026-001",
        statusLabel: "Expedido",
        orderUrl: "https://portal.example.com/dashboard/ordens/o1",
      }
    );
  });

  it("does not email when the company has no CLIENT user", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await updateOrderStatus("o1", "shipped");
    expect(mockSendOrderStatusUpdateEmail).not.toHaveBeenCalled();
  });

  it("does not throw when email delivery fails", async () => {
    mockSendOrderStatusUpdateEmail.mockRejectedValue(new Error("Resend down"));
    await expect(updateOrderStatus("o1", "shipped")).resolves.toBeUndefined();
    expect(prismaMock.order.update).toHaveBeenCalled();
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

describe("createOrder — priority", () => {
  beforeEach(() => mockAuth.mockResolvedValue(adminSession));

  it("defaults priority to normal when omitted", async () => {
    await createOrder(validOrderInput);
    const data = prismaMock.order.create.mock.calls[0][0].data;
    expect(data.priority).toBe("normal");
  });

  it("persists an urgent priority when provided", async () => {
    await createOrder({ ...validOrderInput, priority: "urgent" });
    const data = prismaMock.order.create.mock.calls[0][0].data;
    expect(data.priority).toBe("urgent");
  });

  it("rejects an invalid priority value", async () => {
    await expect(
      createOrder({ ...validOrderInput, priority: "super" as never })
    ).rejects.toThrow();
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });
});

const sourceOrder = {
  id: "o1",
  reference: "ENC-2026-001",
  companyId: "c1",
  status: "delivered",
  items: [
    {
      id: "i1",
      reference: "PAR-M8",
      description: "Parafuso M8",
      quantity: 10,
      unit: "un",
      unitPriceEur: 0.35,
    },
  ],
};

const validReorder = {
  sourceOrderId: "o1",
  expectedDate: "2026-09-01",
  items: [{ sourceItemId: "i1", quantity: 25 }],
};

describe("reorderOrder — authorization", () => {
  beforeEach(() => prismaMock.order.findUnique.mockResolvedValue(sourceOrder));

  it("rejects an unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(reorderOrder(validReorder)).rejects.toThrow("Não autorizado.");
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects an admin (reorder is a client self-service action)", async () => {
    mockAuth.mockResolvedValue(adminSession);
    await expect(reorderOrder(validReorder)).rejects.toThrow("Não autorizado.");
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects a client from another company", async () => {
    mockAuth.mockResolvedValue({
      user: { role: "CLIENT", id: "u9", companyId: "OTHER", name: "Outro" },
    });
    await expect(reorderOrder(validReorder)).rejects.toThrow("Não autorizado.");
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });
});

describe("reorderOrder — validation", () => {
  beforeEach(() => mockAuth.mockResolvedValue(clientSession));

  it("throws when the source order does not exist", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    await expect(reorderOrder(validReorder)).rejects.toThrow(
      "Encomenda não encontrada."
    );
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("throws when a line references an item not in the source order", async () => {
    prismaMock.order.findUnique.mockResolvedValue(sourceOrder);
    await expect(
      reorderOrder({ ...validReorder, items: [{ sourceItemId: "ghost", quantity: 5 }] })
    ).rejects.toThrow("Artigo não encontrado na encomenda original.");
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive quantity", async () => {
    prismaMock.order.findUnique.mockResolvedValue(sourceOrder);
    await expect(
      reorderOrder({ ...validReorder, items: [{ sourceItemId: "i1", quantity: 0 }] })
    ).rejects.toThrow();
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });
});

describe("reorderOrder — creation", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(clientSession);
    prismaMock.order.findUnique.mockResolvedValue(sourceOrder);
  });

  it("creates a pending order for the source company with no batch number", async () => {
    await reorderOrder(validReorder);
    const data = prismaMock.order.create.mock.calls[0][0].data;
    expect(data.status).toBe("pending");
    expect(data.companyId).toBe("c1");
    expect(data.priority).toBe("normal");
    expect(data.batchNumber).toBeNull();
  });

  it("copies item reference/description/unit/price from the source and only takes the client quantity", async () => {
    await reorderOrder(validReorder);
    const data = prismaMock.order.create.mock.calls[0][0].data;
    expect(data.items.create).toEqual([
      {
        reference: "PAR-M8",
        description: "Parafuso M8",
        quantity: 25,
        unit: "un",
        unitPriceEur: 0.35,
      },
    ]);
  });

  it("returns the new order id", async () => {
    prismaMock.order.create.mockResolvedValue({ id: "o-reorder" });
    const id = await reorderOrder(validReorder);
    expect(id).toBe("o-reorder");
  });
});
