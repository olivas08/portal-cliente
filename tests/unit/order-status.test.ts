import { describe, it, expect } from "vitest";
import {
  computeStatusDates,
  ORDER_STATUS_SEQUENCE,
} from "@/services/order-status";

const NOW = new Date("2026-07-21T10:00:00Z");
const EXISTING = {
  shippedDate: new Date("2026-06-18T00:00:00Z"),
  deliveredDate: new Date("2026-06-20T00:00:00Z"),
};

describe("computeStatusDates", () => {
  it("stamps shippedDate and clears deliveredDate when shipped", () => {
    const { shippedDate, deliveredDate } = computeStatusDates(
      "shipped",
      EXISTING,
      NOW,
    );
    expect(shippedDate).toBe(NOW);
    expect(deliveredDate).toBeNull();
  });

  it("stamps deliveredDate and preserves shippedDate when delivered", () => {
    const { shippedDate, deliveredDate } = computeStatusDates(
      "delivered",
      EXISTING,
      NOW,
    );
    expect(deliveredDate).toBe(NOW);
    expect(shippedDate).toBe(EXISTING.shippedDate);
  });

  it.each(["pending", "production", "quality"] as const)(
    "clears both dates when moved back to %s",
    (status) => {
      const { shippedDate, deliveredDate } = computeStatusDates(
        status,
        EXISTING,
        NOW,
      );
      expect(shippedDate).toBeNull();
      expect(deliveredDate).toBeNull();
    },
  );
});

describe("ORDER_STATUS_SEQUENCE", () => {
  it("lists the lifecycle in progress order", () => {
    expect(ORDER_STATUS_SEQUENCE).toEqual([
      "pending",
      "production",
      "quality",
      "shipped",
      "delivered",
    ]);
  });
});
