import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockAuth, prismaMock } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  prismaMock: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateOrderStatus } from "@/actions/orders";

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
