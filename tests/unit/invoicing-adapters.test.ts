import { describe, it, expect } from "vitest";
import { requireEnv, lineTotalEur, InvoiceProviderNotConfiguredError } from "@/services/invoicing/shared";
import { createMoloniAdapter } from "@/services/invoicing/adapters/moloni";
import { createVendusAdapter } from "@/services/invoicing/adapters/vendus";

describe("requireEnv", () => {
  it("returns the vars when every value is present", () => {
    expect(requireEnv("Test", { A: "1", B: "2" })).toEqual({ A: "1", B: "2" });
  });

  it("lists every missing variable in one error", () => {
    expect(() => requireEnv("Moloni", { MOLONI_CLIENT_ID: undefined, OTHER: "" })).toThrow(
      InvoiceProviderNotConfiguredError,
    );
    expect(() => requireEnv("Moloni", { MOLONI_CLIENT_ID: undefined, OTHER: "" })).toThrow(
      /MOLONI_CLIENT_ID/,
    );
  });
});

describe("lineTotalEur", () => {
  it("multiplies quantity by unit price", () => {
    expect(lineTotalEur({ quantity: 4, unitPriceEur: 2.5 })).toBe(10);
  });
});

describe("adapters — isConfigured", () => {
  it("Moloni reports unconfigured when env is empty", () => {
    expect(createMoloniAdapter().isConfigured()).toBe(false);
  });

  it("Vendus reports unconfigured when env is empty", () => {
    expect(createVendusAdapter().isConfigured()).toBe(false);
  });
});
