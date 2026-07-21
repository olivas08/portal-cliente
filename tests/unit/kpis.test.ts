import { describe, it, expect } from "vitest";
import { computeOrderKpis } from "@/lib/kpis";
import type { OrderVM } from "@/lib/types";

function makeOrder(overrides: Partial<OrderVM>): OrderVM {
  return {
    id: overrides.id ?? "o1",
    reference: overrides.reference ?? "ENC-2026-001",
    companyId: overrides.companyId ?? "c1",
    clientCompany: overrides.clientCompany ?? "Auto Peças Mota, Lda.",
    status: overrides.status ?? "delivered",
    priority: overrides.priority ?? "normal",
    createdDate: overrides.createdDate ?? "2026-05-01",
    expectedDate: overrides.expectedDate ?? "2026-05-15",
    shippedDate: overrides.shippedDate,
    deliveredDate: overrides.deliveredDate ?? "2026-05-14",
    items: overrides.items ?? [],
    attachments: overrides.attachments ?? [],
    batchNumber: overrides.batchNumber ?? "LT-1",
    observations: overrides.observations,
  };
}

describe("computeOrderKpis — empty input", () => {
  it("returns nulls/zeros without dividing by zero", () => {
    const kpis = computeOrderKpis([]);
    expect(kpis.totalOrders).toBe(0);
    expect(kpis.deliveredCount).toBe(0);
    expect(kpis.avgLeadTimeDays).toBeNull();
    expect(kpis.onTimeDeliveryRate).toBeNull();
    expect(kpis.monthly).toEqual([]);
  });
});

describe("computeOrderKpis — headline numbers", () => {
  it("counts totals, in-progress and urgent-in-progress correctly", () => {
    const orders = [
      makeOrder({ id: "o1", status: "delivered" }),
      makeOrder({ id: "o2", status: "production", priority: "urgent" }),
      makeOrder({ id: "o3", status: "shipped", priority: "normal" }),
    ];
    const kpis = computeOrderKpis(orders);
    expect(kpis.totalOrders).toBe(3);
    expect(kpis.deliveredCount).toBe(1);
    expect(kpis.inProgressCount).toBe(2);
    expect(kpis.urgentInProgressCount).toBe(1);
  });

  it("excludes cancelled orders from in-progress and counts them separately", () => {
    const orders = [
      makeOrder({ id: "o1", status: "delivered" }),
      makeOrder({ id: "o2", status: "production", priority: "urgent" }),
      makeOrder({ id: "o3", status: "cancelled", priority: "urgent" }),
      makeOrder({ id: "o4", status: "cancelled", priority: "normal" }),
    ];
    const kpis = computeOrderKpis(orders);
    expect(kpis.totalOrders).toBe(4);
    expect(kpis.inProgressCount).toBe(1);
    expect(kpis.urgentInProgressCount).toBe(1);
    expect(kpis.cancelledCount).toBe(2);
  });

  it("computes average lead time in days across delivered orders", () => {
    const orders = [
      makeOrder({ id: "o1", createdDate: "2026-05-01", deliveredDate: "2026-05-11" }), // 10 days
      makeOrder({ id: "o2", createdDate: "2026-05-01", deliveredDate: "2026-05-21" }), // 20 days
    ];
    const kpis = computeOrderKpis(orders);
    expect(kpis.avgLeadTimeDays).toBe(15);
  });

  it("computes the on-time delivery rate against the expected date", () => {
    const orders = [
      makeOrder({ id: "o1", expectedDate: "2026-05-15", deliveredDate: "2026-05-14" }), // on time
      makeOrder({ id: "o2", expectedDate: "2026-05-15", deliveredDate: "2026-05-15" }), // exactly on time
      makeOrder({ id: "o3", expectedDate: "2026-05-15", deliveredDate: "2026-05-20" }), // late
      makeOrder({ id: "o4", expectedDate: "2026-05-15", deliveredDate: "2026-05-16" }), // late
    ];
    const kpis = computeOrderKpis(orders);
    expect(kpis.onTimeDeliveryRate).toBe(50);
  });

  it("ignores non-delivered orders in lead time / on-time calculations", () => {
    const orders = [
      makeOrder({ id: "o1", status: "shipped", deliveredDate: undefined }),
    ];
    const kpis = computeOrderKpis(orders);
    expect(kpis.avgLeadTimeDays).toBeNull();
    expect(kpis.onTimeDeliveryRate).toBeNull();
  });
});

describe("computeOrderKpis — monthly trend", () => {
  it("groups delivered orders by delivery month, sorted chronologically", () => {
    const orders = [
      makeOrder({ id: "o1", deliveredDate: "2026-06-05", expectedDate: "2026-06-10", createdDate: "2026-05-25" }),
      makeOrder({ id: "o2", deliveredDate: "2026-05-20", expectedDate: "2026-05-15", createdDate: "2026-05-01" }),
      makeOrder({ id: "o3", deliveredDate: "2026-05-10", expectedDate: "2026-05-12", createdDate: "2026-05-01" }),
    ];
    const kpis = computeOrderKpis(orders);
    expect(kpis.monthly.map((m) => m.month)).toEqual(["2026-05", "2026-06"]);

    const may = kpis.monthly[0];
    expect(may.delivered).toBe(2);
    expect(may.onTimeRate).toBe(50); // o3 on time, o2 late

    const june = kpis.monthly[1];
    expect(june.delivered).toBe(1);
    expect(june.onTimeRate).toBe(100);
  });
});
