import { describe, it, expect } from "vitest";
import {
  computeNextDueDate,
  maintenanceUrgency,
  canStartMaintenanceTask,
  canResolveMaintenanceTask,
  canCancelMaintenanceTask,
} from "@/services/maintenance";

describe("computeNextDueDate", () => {
  it("adds intervalDays to lastDoneAt when the plan has been done before", () => {
    const lastDoneAt = new Date("2026-01-01T00:00:00Z");
    const createdAt = new Date("2025-01-01T00:00:00Z");
    const due = computeNextDueDate(lastDoneAt, createdAt, 30);
    expect(due.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("falls back to createdAt when the plan has never been done", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const due = computeNextDueDate(null, createdAt, 30);
    expect(due.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
});

describe("maintenanceUrgency", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("is overdue when the due date is in the past", () => {
    const due = new Date("2026-06-14T00:00:00Z");
    expect(maintenanceUrgency(due, now)).toBe("overdue");
  });

  it("is due_soon within the default 7-day window", () => {
    const due = new Date("2026-06-20T00:00:00Z");
    expect(maintenanceUrgency(due, now)).toBe("due_soon");
  });

  it("is ok when comfortably beyond the due_soon window", () => {
    const due = new Date("2026-07-01T00:00:00Z");
    expect(maintenanceUrgency(due, now)).toBe("ok");
  });

  it("respects a custom due_soon window", () => {
    const due = new Date("2026-06-17T00:00:00Z");
    expect(maintenanceUrgency(due, now, 1)).toBe("ok");
    expect(maintenanceUrgency(due, now, 3)).toBe("due_soon");
  });
});

describe("canStartMaintenanceTask", () => {
  it("allows starting an open task that hasn't started yet", () => {
    expect(canStartMaintenanceTask("open", null)).toBe(true);
  });

  it("rejects starting an already-started task", () => {
    expect(canStartMaintenanceTask("open", new Date())).toBe(false);
  });

  it("rejects starting a resolved or cancelled task", () => {
    expect(canStartMaintenanceTask("resolved", null)).toBe(false);
    expect(canStartMaintenanceTask("cancelled", null)).toBe(false);
  });
});

describe("canResolveMaintenanceTask / canCancelMaintenanceTask", () => {
  it("only allow acting on open tasks", () => {
    expect(canResolveMaintenanceTask("open")).toBe(true);
    expect(canResolveMaintenanceTask("resolved")).toBe(false);
    expect(canResolveMaintenanceTask("cancelled")).toBe(false);

    expect(canCancelMaintenanceTask("open")).toBe(true);
    expect(canCancelMaintenanceTask("resolved")).toBe(false);
    expect(canCancelMaintenanceTask("cancelled")).toBe(false);
  });
});
