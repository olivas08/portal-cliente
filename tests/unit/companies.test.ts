import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    company: { findUnique: vi.fn(), update: vi.fn() },
  };
  return { prismaMock };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import { updateCompanyFiscalInfo } from "@/services/companies.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateCompanyFiscalInfo", () => {
  it("throws when the company doesn't exist", async () => {
    prismaMock.company.findUnique.mockResolvedValue(null);
    await expect(
      updateCompanyFiscalInfo("missing", {
        taxId: "123456789",
        billingAddress: null,
        billingPostalCode: null,
        billingCity: null,
        billingCountry: null,
      }),
    ).rejects.toThrow(/não encontrado/i);
  });

  it("rejects a NIF that isn't 9 digits", async () => {
    prismaMock.company.findUnique.mockResolvedValue({ id: "c1" });
    await expect(
      updateCompanyFiscalInfo("c1", {
        taxId: "12345",
        billingAddress: null,
        billingPostalCode: null,
        billingCity: null,
        billingCountry: null,
      }),
    ).rejects.toThrow();
  });

  it("trims blank strings down to null instead of storing empty strings", async () => {
    prismaMock.company.findUnique.mockResolvedValue({ id: "c1" });
    prismaMock.company.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: "c1",
      ...data,
    }));

    await updateCompanyFiscalInfo("c1", {
      taxId: "123456789",
      billingAddress: "   ",
      billingPostalCode: "",
      billingCity: "  Vale de Cambra  ",
      billingCountry: null,
    });

    const data = prismaMock.company.update.mock.calls[0][0].data;
    expect(data.billingAddress).toBeNull();
    expect(data.billingPostalCode).toBeNull();
    expect(data.billingCity).toBe("Vale de Cambra");
  });

  it("defaults billingCountry to Portugal when left blank", async () => {
    prismaMock.company.findUnique.mockResolvedValue({ id: "c1" });
    prismaMock.company.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: "c1",
      ...data,
    }));

    const result = await updateCompanyFiscalInfo("c1", {
      taxId: "123456789",
      billingAddress: null,
      billingPostalCode: null,
      billingCity: null,
      billingCountry: null,
    });

    expect(result.billingCountry).toBe("Portugal");
  });

  it("accepts a null taxId (clearing a previously set NIF)", async () => {
    prismaMock.company.findUnique.mockResolvedValue({ id: "c1" });
    prismaMock.company.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: "c1",
      ...data,
    }));

    const result = await updateCompanyFiscalInfo("c1", {
      taxId: null,
      billingAddress: null,
      billingPostalCode: null,
      billingCity: null,
      billingCountry: null,
    });

    expect(result.taxId).toBeNull();
  });
});
