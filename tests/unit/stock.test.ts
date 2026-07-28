import { describe, it, expect } from "vitest";
import {
  computeShortfalls,
  type MaterialRequirement,
} from "@/services/production-status";

function req(
  partial: Partial<MaterialRequirement> & {
    requiredQty: number;
    availableQty: number;
  },
): MaterialRequirement {
  return {
    materialId: partial.materialId ?? "m1",
    materialRef: partial.materialRef ?? "MP-001",
    materialName: partial.materialName ?? "Material",
    unit: partial.unit ?? "un",
    requiredQty: partial.requiredQty,
    availableQty: partial.availableQty,
  };
}

describe("computeShortfalls", () => {
  it("returns empty when every material has enough stock", () => {
    const result = computeShortfalls([
      req({ requiredQty: 10, availableQty: 10 }),
      req({ requiredQty: 5, availableQty: 20 }),
    ]);
    expect(result).toEqual([]);
  });

  it("treats exact-match stock as sufficient", () => {
    expect(computeShortfalls([req({ requiredQty: 31.5, availableQty: 31.5 })]))
      .toHaveLength(0);
  });

  it("flags materials short of stock with the missing quantity", () => {
    const result = computeShortfalls([
      req({ materialRef: "MP-A", requiredQty: 6, availableQty: 3 }),
      req({ materialRef: "MP-B", requiredQty: 2, availableQty: 10 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].materialRef).toBe("MP-A");
    expect(result[0].missingQty).toBe(3);
  });

  it("never reports a negative missing quantity", () => {
    const [short] = computeShortfalls([
      req({ requiredQty: 5, availableQty: 4.5 }),
    ]);
    expect(short.missingQty).toBeCloseTo(0.5, 5);
    expect(short.missingQty).toBeGreaterThan(0);
  });

  it("returns empty for a work order with no material requirements", () => {
    expect(computeShortfalls([])).toEqual([]);
  });

  it("handles negative available stock (oversold) as a shortfall", () => {
    const [short] = computeShortfalls([
      req({ requiredQty: 5, availableQty: -2 }),
    ]);
    expect(short.missingQty).toBe(7);
  });
});
