import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockAuth, prismaMock } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  prismaMock: {
    company: { findUnique: vi.fn() },
    pricingSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    operationType: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    quote: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    quoteLine: { deleteMany: vi.fn(), createMany: vi.fn() },
    order: { create: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn(() => Promise.resolve([] as { id: string }[])) },
    notification: { createMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createQuote,
  updateQuote,
  sendQuote,
  decideQuote,
  updatePricingSettings,
  createOperationType,
} from "@/actions/quotes";

const admin = { user: { role: "ADMIN", id: "a1", name: "Sofia" } };
const client = {
  user: { role: "CLIENT", id: "u1", companyId: "c1", name: "Jorge" },
};
const otherClient = {
  user: { role: "CLIENT", id: "u2", companyId: "c2", name: "Ana" },
};

const PRICING = {
  id: "default",
  steelPriceEurKg: 5,
  defaultMarginPercent: 20,
  updatedAt: new Date(),
};

const OP_LASER = {
  id: "op-laser",
  key: "corte_laser",
  name: "Corte a laser",
  unit: "min",
  ratePerUnitEur: 1,
  active: true,
  sequence: 1,
};
const OP_BEND = {
  id: "op-bend",
  key: "quinagem",
  name: "Quinagem",
  unit: "dobra",
  ratePerUnitEur: 2,
  active: true,
  sequence: 2,
};

const baseInput = {
  companyId: "c1",
  subject: "Estrutura inox",
  marginPercent: 20,
  lines: [
    {
      description: "Painel lateral",
      quantity: 2,
      unit: "un",
      materialWeightKg: 3,
      operations: [{ operationTypeId: "op-laser", quantity: 10 }],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(admin);
  prismaMock.company.findUnique.mockResolvedValue({ id: "c1", name: "Chaparia Silva" });
  prismaMock.pricingSettings.findUnique.mockResolvedValue(PRICING);
  prismaMock.operationType.findMany.mockResolvedValue([OP_LASER, OP_BEND]);
  prismaMock.quote.count.mockResolvedValue(0);
  prismaMock.order.count.mockResolvedValue(0);
  prismaMock.quote.create.mockResolvedValue({ id: "q-new" });
  prismaMock.quote.update.mockResolvedValue({});
  prismaMock.quoteLine.deleteMany.mockResolvedValue({});
  prismaMock.quoteLine.createMany.mockResolvedValue({});
});

describe("createQuote — authorization", () => {
  it("rejects a client", async () => {
    mockAuth.mockResolvedValue(client);
    const res = await createQuote(baseInput);
    expect(res).toEqual({ error: "Não autorizado." });
    expect(prismaMock.quote.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown company", async () => {
    prismaMock.company.findUnique.mockResolvedValue(null);
    const res = await createQuote(baseInput);
    expect(res).toEqual({ error: "Cliente não encontrado." });
  });
});

describe("createQuote — pricing", () => {
  it("costs each line from weight/operation drivers, applies margin, and sums the total", async () => {
    // unitCost = 3kg*5€/kg + 10min*1€/min = 25€; line total = 25 * qty(2) * 1.2 = 60€
    await createQuote(baseInput);

    expect(prismaMock.quote.create).toHaveBeenCalledTimes(1);
    const arg = prismaMock.quote.create.mock.calls[0][0];
    expect(arg.data.totalEur).toBeCloseTo(60, 2);
    expect(arg.data.lines.create[0].unitCostEur).toBeCloseTo(25, 2);
    expect(arg.data.lines.create[0].lineTotalEur).toBeCloseTo(60, 2);
    expect(arg.data.lines.create[0].operations.create[0]).toMatchObject({
      operationTypeId: "op-laser",
      name: "Corte a laser",
      unit: "min",
      quantity: 10,
      ratePerUnitEur: 1,
      costEur: 10,
    });
  });

  it("sums multiple lines, each with its own operations, independently", async () => {
    const input = {
      ...baseInput,
      lines: [
        baseInput.lines[0],
        {
          description: "Base quinada",
          quantity: 1,
          unit: "un",
          materialWeightKg: 0,
          operations: [{ operationTypeId: "op-bend", quantity: 4 }],
        },
      ],
    };
    // line 2: unitCost = 4 bends * 2€ = 8€; total = 8 * 1 * 1.2 = 9.6€
    await createQuote(input);

    const arg = prismaMock.quote.create.mock.calls[0][0];
    expect(arg.data.lines.create).toHaveLength(2);
    expect(arg.data.lines.create[1].lineTotalEur).toBeCloseTo(9.6, 2);
    expect(arg.data.totalEur).toBeCloseTo(60 + 9.6, 2);
  });

  it("supports multiple operations on the same line", async () => {
    const input = {
      ...baseInput,
      lines: [
        {
          description: "Painel completo",
          quantity: 1,
          unit: "un",
          materialWeightKg: 0,
          operations: [
            { operationTypeId: "op-laser", quantity: 5 },
            { operationTypeId: "op-bend", quantity: 3 },
          ],
        },
      ],
    };
    // unitCost = 5*1 + 3*2 = 11€; total = 11 * 1 * 1.2 = 13.2€
    await createQuote(input);

    const arg = prismaMock.quote.create.mock.calls[0][0];
    expect(arg.data.lines.create[0].operations.create).toHaveLength(2);
    expect(arg.data.lines.create[0].lineTotalEur).toBeCloseTo(13.2, 2);
  });

  it("fails with a clear error when an operation type doesn't exist", async () => {
    prismaMock.operationType.findMany.mockResolvedValue([]);
    const res = await createQuote(baseInput);
    expect(res).toEqual({ error: "Tipo de operação não encontrado." });
  });
});

describe("updateQuote / sendQuote — draft-only guard", () => {
  it("refuses to edit a quote that has already been sent", async () => {
    prismaMock.quote.findUnique.mockResolvedValue({
      id: "q1",
      status: "sent",
      lines: [],
    });

    const res = await updateQuote("q1", baseInput);

    expect(res).toEqual({ error: "Só é possível editar orçamentos em rascunho." });
    expect(prismaMock.quote.update).not.toHaveBeenCalled();
  });

  it("updates a draft quote's lines via a single nested write", async () => {
    prismaMock.quote.findUnique.mockResolvedValue({
      id: "q1",
      status: "draft",
      companyId: "c1",
      lines: [],
    });

    await updateQuote("q1", baseInput);

    expect(prismaMock.quote.update).toHaveBeenCalledTimes(1);
    const arg = prismaMock.quote.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "q1" });
    expect(arg.data.lines.deleteMany).toEqual({});
    expect(arg.data.lines.create[0].operations.create[0]).toMatchObject({
      operationTypeId: "op-laser",
      costEur: 10,
    });
  });

  it("sends a draft quote and notifies the client company", async () => {
    prismaMock.quote.findUnique.mockResolvedValue({
      id: "q1",
      status: "draft",
      companyId: "c1",
      reference: "ORC-2026-001",
      subject: "Estrutura inox",
      lines: [],
    });
    prismaMock.user.findMany.mockResolvedValue([{ id: "u1" }]);

    const res = await sendQuote("q1");

    expect(res).toBeUndefined();
    expect(prismaMock.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q1" },
        data: expect.objectContaining({ status: "sent" }),
      }),
    );
    expect(prismaMock.notification.createMany).toHaveBeenCalled();
  });

  it("refuses to send an already-sent quote", async () => {
    prismaMock.quote.findUnique.mockResolvedValue({ id: "q1", status: "sent", lines: [] });
    const res = await sendQuote("q1");
    expect(res).toEqual({ error: "Só é possível editar orçamentos em rascunho." });
  });
});

describe("decideQuote — company scoping and order creation", () => {
  const sentQuote = {
    id: "q1",
    companyId: "c1",
    status: "sent",
    reference: "ORC-2026-002",
    subject: "Estrutura inox",
    validUntil: null,
    lines: [
      {
        sequence: 1,
        description: "Painel lateral",
        quantity: 2,
        unit: "un",
        lineTotalEur: 60,
      },
    ],
    company: { id: "c1", name: "Chaparia Silva" },
  };

  it("rejects a client from another company", async () => {
    mockAuth.mockResolvedValue(otherClient);
    prismaMock.quote.findUnique.mockResolvedValue(sentQuote);

    const res = await decideQuote("q1", "accepted");

    expect(res).toEqual({ error: "Não autorizado." });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("rejects deciding a quote that isn't sent", async () => {
    mockAuth.mockResolvedValue(client);
    prismaMock.quote.findUnique.mockResolvedValue({ ...sentQuote, status: "draft" });

    const res = await decideQuote("q1", "accepted");

    expect(res).toEqual({ error: "Este orçamento já não está disponível para decisão." });
  });

  it("accepting creates an Order from the quote lines and links it back", async () => {
    mockAuth.mockResolvedValue(client);
    prismaMock.quote.findUnique.mockResolvedValue(sentQuote);
    prismaMock.order.create.mockResolvedValue({ id: "o-new", reference: "ENC-2026-010" });

    const res = await decideQuote("q1", "accepted");

    expect(res).toBe("o-new");
    expect(prismaMock.order.create).toHaveBeenCalledTimes(1);
    const orderArg = prismaMock.order.create.mock.calls[0][0];
    expect(orderArg.data.companyId).toBe("c1");
    expect(orderArg.data.items.create[0].unitPriceEur).toBeCloseTo(30, 2); // 60€ / qty 2
    expect(prismaMock.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "accepted", orderId: "o-new" }),
      }),
    );
  });

  it("rejecting does not create an Order", async () => {
    mockAuth.mockResolvedValue(client);
    prismaMock.quote.findUnique.mockResolvedValue(sentQuote);

    const res = await decideQuote("q1", "rejected");

    expect(res).toBeNull();
    expect(prismaMock.order.create).not.toHaveBeenCalled();
    expect(prismaMock.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "rejected", orderId: null }) }),
    );
  });
});

describe("updatePricingSettings — authorization", () => {
  it("rejects a client", async () => {
    mockAuth.mockResolvedValue(client);
    const res = await updatePricingSettings({
      steelPriceEurKg: 5,
      defaultMarginPercent: 20,
    });
    expect(res).toEqual({ error: "Não autorizado." });
    expect(prismaMock.pricingSettings.upsert).not.toHaveBeenCalled();
  });
});

describe("createOperationType — authorization and uniqueness", () => {
  it("rejects a client", async () => {
    mockAuth.mockResolvedValue(client);
    const res = await createOperationType({
      key: "jato_agua",
      name: "Jato de água",
      unit: "min",
      ratePerUnitEur: 1.1,
      active: true,
    });
    expect(res).toEqual({ error: "Não autorizado." });
    expect(prismaMock.operationType.create).not.toHaveBeenCalled();
  });

  it("creates a new operation type with the next sequence", async () => {
    prismaMock.operationType.aggregate.mockResolvedValue({ _max: { sequence: 4 } });
    prismaMock.operationType.create.mockResolvedValue({ id: "op-new" });

    const res = await createOperationType({
      key: "jato_agua",
      name: "Jato de água",
      unit: "min",
      ratePerUnitEur: 1.1,
      active: true,
    });

    expect(res).toBe("op-new");
    expect(prismaMock.operationType.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sequence: 5 }) }),
    );
  });

  it("surfaces a friendly error on duplicate key", async () => {
    prismaMock.operationType.aggregate.mockResolvedValue({ _max: { sequence: 0 } });
    prismaMock.operationType.create.mockRejectedValue({ code: "P2002" });

    const res = await createOperationType({
      key: "corte_laser",
      name: "Corte a laser",
      unit: "min",
      ratePerUnitEur: 1,
      active: true,
    });

    expect(res).toEqual({ error: "Já existe uma operação com essa chave." });
  });
});
