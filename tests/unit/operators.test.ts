import { describe, it, expect } from "vitest";
import {
  createOperatorSchema,
  resetOperatorPinSchema,
  setOperatorActiveSchema,
} from "@/services/production.service";

describe("createOperatorSchema", () => {
  it("accepts a valid name and 4-digit PIN", () => {
    const r = createOperatorSchema.safeParse({ name: "João Ferreira", pin: "1234" });
    expect(r.success).toBe(true);
  });

  it("accepts a 12-digit PIN", () => {
    const r = createOperatorSchema.safeParse({ name: "Ana", pin: "123456789012" });
    expect(r.success).toBe(true);
  });

  it("rejects a PIN shorter than 4 digits", () => {
    expect(createOperatorSchema.safeParse({ name: "Ana", pin: "12" }).success).toBe(false);
  });

  it("rejects a PIN longer than 12 digits", () => {
    expect(
      createOperatorSchema.safeParse({ name: "Ana", pin: "1234567890123" }).success,
    ).toBe(false);
  });

  it("rejects a non-numeric PIN", () => {
    expect(createOperatorSchema.safeParse({ name: "Ana", pin: "12ab" }).success).toBe(false);
  });

  it("rejects an empty/too-short name", () => {
    expect(createOperatorSchema.safeParse({ name: "A", pin: "1234" }).success).toBe(false);
  });

  it("trims the name", () => {
    const r = createOperatorSchema.parse({ name: "  Rui  ", pin: "1234" });
    expect(r.name).toBe("Rui");
  });
});

describe("resetOperatorPinSchema", () => {
  it("requires an operatorId and valid PIN", () => {
    expect(
      resetOperatorPinSchema.safeParse({ operatorId: "op1", pin: "9999" }).success,
    ).toBe(true);
    expect(
      resetOperatorPinSchema.safeParse({ operatorId: "", pin: "9999" }).success,
    ).toBe(false);
    expect(
      resetOperatorPinSchema.safeParse({ operatorId: "op1", pin: "1" }).success,
    ).toBe(false);
  });
});

describe("setOperatorActiveSchema", () => {
  it("coerces a boolean active flag", () => {
    const r = setOperatorActiveSchema.safeParse({ operatorId: "op1", active: false });
    expect(r.success).toBe(true);
  });

  it("rejects a missing operatorId", () => {
    expect(
      setOperatorActiveSchema.safeParse({ operatorId: "", active: true }).success,
    ).toBe(false);
  });
});
