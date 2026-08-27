import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findUnique: vi.fn() },
    request: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import { getOrderById, getRequestById } from "@/lib/data";

beforeEach(() => vi.clearAllMocks());

describe("getOrderById → OrderVM mapping", () => {
  it("serializes dates to YYYY-MM-DD and maps nested items", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "o1",
      reference: "ENC-2026-041",
      companyId: "mota",
      company: { name: "Auto Peças Mota, Lda." },
      status: "delivered",
      priority: "normal",
      createdDate: new Date("2026-05-10T12:00:00Z"),
      expectedDate: new Date("2026-05-28T00:00:00Z"),
      shippedDate: new Date("2026-05-26T00:00:00Z"),
      deliveredDate: new Date("2026-05-27T00:00:00Z"),
      qualityNotes: "Conforme",
      observations: null,
      batchNumber: "LT-2026-041",
      items: [
        {
          id: "i1",
          reference: "PAR-M8-20-IX",
          description: "Parafuso M8×20",
          quantity: 500,
          unit: "un",
          unitPriceEur: 0.35,
        },
      ],
      documents: [
        {
          id: "d1",
          fileName: "certificado.pdf",
          storageKey: "orders/o1/certificado.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          uploadedById: "u1",
          uploadedByName: "Admin",
          createdAt: new Date("2026-05-27T10:00:00Z"),
        },
      ],
    });

    const vm = await getOrderById("o1");
    expect(vm).not.toBeNull();
    expect(vm!.clientCompany).toBe("Auto Peças Mota, Lda.");
    expect(vm!.createdDate).toBe("2026-05-10");
    expect(vm!.shippedDate).toBe("2026-05-26");
    expect(vm!.deliveredDate).toBe("2026-05-27");
    expect(vm!.observations).toBeUndefined();
    expect(vm!.items).toHaveLength(1);
    expect(vm!.items[0].unitPriceEur).toBe(0.35);
    expect(vm!.attachments).toHaveLength(1);
    expect(vm!.attachments[0].fileName).toBe("certificado.pdf");
  });

  it("leaves optional dates undefined when null", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "o2",
      reference: "ENC-2026-067",
      companyId: "norte",
      company: { name: "Plásticos do Norte, Lda." },
      status: "pending",
      priority: "normal",
      createdDate: new Date("2026-06-28T00:00:00Z"),
      expectedDate: new Date("2026-07-20T00:00:00Z"),
      shippedDate: null,
      deliveredDate: null,
      qualityNotes: null,
      observations: "ABS V0",
      batchNumber: "LT-2026-067",
      items: [],
      documents: [],
    });

    const vm = await getOrderById("o2");
    expect(vm!.shippedDate).toBeUndefined();
    expect(vm!.deliveredDate).toBeUndefined();
    expect(vm!.qualityNotes).toBeUndefined();
    expect(vm!.observations).toBe("ABS V0");
  });

  it("returns null when the order is missing", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    expect(await getOrderById("missing")).toBeNull();
  });
});

describe("getRequestById → RequestVM mapping", () => {
  it("maps company name and keeps message dates as full ISO", async () => {
    const msgDate = new Date("2026-06-20T09:15:00Z");
    prismaMock.request.findUnique.mockResolvedValue({
      id: "r1",
      companyId: "mota",
      company: { name: "Auto Peças Mota, Lda." },
      type: "quote",
      subject: "Orçamento M10",
      status: "responded",
      createdDate: new Date("2026-06-20T00:00:00Z"),
      messages: [
        {
          id: "m1",
          from: "client",
          authorName: "Jorge Mota",
          text: "Bom dia",
          date: msgDate,
        },
      ],
    });

    const vm = await getRequestById("r1");
    expect(vm!.clientCompany).toBe("Auto Peças Mota, Lda.");
    expect(vm!.createdDate).toBe("2026-06-20");
    expect(vm!.messages[0].date).toBe(msgDate.toISOString());
  });
});
