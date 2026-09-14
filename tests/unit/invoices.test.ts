import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock, mockGetActive } = vi.hoisted(() => ({
  prismaMock: {
    order: { findUnique: vi.fn() },
    invoice: { upsert: vi.fn() },
  },
  mockGetActive: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/services/invoicing/registry", () => ({
  getActiveInvoiceProvider: mockGetActive,
}));

import { issueInvoice } from "@/services/invoices.service";

beforeEach(() => vi.clearAllMocks());

describe("issueInvoice", () => {
  it("rejects a missing order", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    await expect(issueInvoice("o-missing")).rejects.toThrow(
      "Encomenda não encontrada.",
    );
  });

  it("rejects an order that is not delivered", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "o1",
      status: "production",
      items: [{ quantity: 1, unitPriceEur: 10 }],
      company: { name: "Mota" },
      invoice: null,
    });
    await expect(issueInvoice("o1")).rejects.toThrow(/já entregues/);
  });

  it("returns the existing invoice when already issued (idempotent)", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "o1",
      status: "delivered",
      items: [{ quantity: 1, unitPriceEur: 10 }],
      company: { name: "Mota" },
      invoice: {
        id: "inv1",
        orderId: "o1",
        provider: "moloni",
        status: "issued",
        number: "FT 1",
        pdfUrl: null,
        totalEur: 10,
        issuedAt: new Date("2026-09-01"),
        errorMessage: null,
      },
    });
    const vm = await issueInvoice("o1");
    expect(vm.number).toBe("FT 1");
    expect(mockGetActive).not.toHaveBeenCalled();
  });

  it("calls the adapter and persists the issued invoice", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "o1",
      reference: "ENC-1",
      status: "delivered",
      items: [
        {
          reference: "P1",
          description: "Peça",
          quantity: 2,
          unit: "un",
          unitPriceEur: 5,
        },
      ],
      company: {
        name: "Mota",
        taxId: "123",
        billingAddress: null,
        billingPostalCode: null,
        billingCity: null,
        billingCountry: "Portugal",
      },
      invoice: null,
    });
    mockGetActive.mockReturnValue({
      provider: "moloni",
      createInvoice: vi.fn().mockResolvedValue({
        externalId: "ext-1",
        number: "FT 9",
        pdfUrl: "https://pdf.example/9",
      }),
    });
    prismaMock.invoice.upsert.mockResolvedValue({
      id: "inv-new",
      orderId: "o1",
      provider: "moloni",
      status: "issued",
      number: "FT 9",
      pdfUrl: "https://pdf.example/9",
      totalEur: 10,
      issuedAt: new Date(),
      errorMessage: null,
    });

    const vm = await issueInvoice("o1");
    expect(vm.number).toBe("FT 9");
    expect(prismaMock.invoice.upsert).toHaveBeenCalledTimes(1);
  });
});
