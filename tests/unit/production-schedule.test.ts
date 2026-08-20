import { describe, it, expect } from "vitest";
import {
  computeProductionSchedule,
  type ScheduleStepInput,
} from "@/services/production-schedule";

const NOW = new Date("2026-08-10T08:00:00Z");

function step(overrides: Partial<ScheduleStepInput> & {
  workOrderId: string;
  sequence: number;
  workstationId: string;
}): ScheduleStepInput {
  return {
    workOrderRef: `OF-${overrides.workOrderId}`,
    productRef: "P-1",
    productName: "Produto",
    companyName: "Cliente",
    priority: "normal",
    workOrderStatus: "released",
    workOrderCreatedAt: NOW,
    workOrderPlannedEnd: null,
    stepId: `${overrides.workOrderId}-${overrides.sequence}`,
    name: "Corte",
    machineId: null,
    machineName: null,
    status: "pending",
    plannedMinutes: 60,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

describe("computeProductionSchedule", () => {
  it("schedules a single pending step starting now", () => {
    const bars = computeProductionSchedule(
      [step({ workOrderId: "A", sequence: 1, workstationId: "ws1" })],
      NOW,
    );
    expect(bars).toHaveLength(1);
    expect(bars[0].start).toEqual(NOW);
    expect(bars[0].end).toEqual(new Date(NOW.getTime() + 60 * 60_000));
    expect(bars[0].isEstimate).toBe(true);
  });

  it("queues two pending steps on the same workstation back-to-back", () => {
    const bars = computeProductionSchedule(
      [
        step({
          workOrderId: "A",
          sequence: 1,
          workstationId: "ws1",
          plannedMinutes: 60,
          workOrderCreatedAt: new Date("2026-08-01T00:00:00Z"),
        }),
        step({
          workOrderId: "B",
          sequence: 1,
          workstationId: "ws1",
          plannedMinutes: 30,
          workOrderCreatedAt: new Date("2026-08-02T00:00:00Z"),
        }),
      ],
      NOW,
    );
    const a = bars.find((b) => b.workOrderId === "A")!;
    const b = bars.find((b) => b.workOrderId === "B")!;
    // A was created first (FIFO tie-break) so it runs first on ws1.
    expect(a.start).toEqual(NOW);
    expect(a.end).toEqual(new Date(NOW.getTime() + 60 * 60_000));
    expect(b.start).toEqual(a.end);
    expect(b.end).toEqual(new Date(a.end.getTime() + 30 * 60_000));
  });

  it("prioritizes urgent work orders ahead of normal ones", () => {
    const bars = computeProductionSchedule(
      [
        step({
          workOrderId: "NORMAL",
          sequence: 1,
          workstationId: "ws1",
          priority: "normal",
          workOrderCreatedAt: new Date("2026-08-01T00:00:00Z"),
        }),
        step({
          workOrderId: "URGENT",
          sequence: 1,
          workstationId: "ws1",
          priority: "urgent",
          workOrderCreatedAt: new Date("2026-08-05T00:00:00Z"),
        }),
      ],
      NOW,
    );
    const urgent = bars.find((b) => b.workOrderId === "URGENT")!;
    expect(urgent.start).toEqual(NOW);
  });

  it("keeps a work order's steps in sequence order across workstations", () => {
    const bars = computeProductionSchedule(
      [
        step({
          workOrderId: "A",
          sequence: 1,
          workstationId: "ws1",
          plannedMinutes: 90,
        }),
        step({
          workOrderId: "A",
          sequence: 2,
          workstationId: "ws2",
          plannedMinutes: 45,
        }),
      ],
      NOW,
    );
    const step1 = bars.find((b) => b.stepId === "A-1")!;
    const step2 = bars.find((b) => b.stepId === "A-2")!;
    expect(step2.start).toEqual(step1.end);
  });

  it("uses the actual startedAt for an in-progress step and projects remaining time", () => {
    const startedAt = new Date("2026-08-10T07:30:00Z"); // 30 min ago
    const bars = computeProductionSchedule(
      [
        step({
          workOrderId: "A",
          sequence: 1,
          workstationId: "ws1",
          status: "in_progress",
          plannedMinutes: 60,
          startedAt,
        }),
      ],
      NOW,
    );
    expect(bars[0].start).toEqual(startedAt);
    // 60 planned - 30 elapsed = 30 remaining.
    expect(bars[0].end).toEqual(new Date(NOW.getTime() + 30 * 60_000));
    expect(bars[0].isEstimate).toBe(false);
  });

  it("clamps an overrunning in-progress step to a minimum remaining buffer", () => {
    const startedAt = new Date("2026-08-10T06:00:00Z"); // 2h ago, planned only 60 min
    const bars = computeProductionSchedule(
      [
        step({
          workOrderId: "A",
          sequence: 1,
          workstationId: "ws1",
          status: "in_progress",
          plannedMinutes: 60,
          startedAt,
        }),
      ],
      NOW,
    );
    expect(bars[0].end).toEqual(new Date(NOW.getTime() + 15 * 60_000));
  });

  it("excludes done steps from the output but uses their finishedAt to seed the next step", () => {
    const finishedAt = new Date("2026-08-10T07:00:00Z");
    const bars = computeProductionSchedule(
      [
        step({
          workOrderId: "A",
          sequence: 1,
          workstationId: "ws1",
          status: "done",
          finishedAt,
        }),
        step({
          workOrderId: "A",
          sequence: 2,
          workstationId: "ws2",
          status: "pending",
          plannedMinutes: 20,
        }),
      ],
      NOW,
    );
    expect(bars).toHaveLength(1);
    expect(bars[0].stepId).toBe("A-2");
    // finishedAt (07:00) is before NOW (08:00), so the pending step starts now.
    expect(bars[0].start).toEqual(NOW);
  });

  it("delays a step whose predecessor finishes in the future", () => {
    const bars = computeProductionSchedule(
      [
        step({
          workOrderId: "A",
          sequence: 1,
          workstationId: "ws1",
          status: "in_progress",
          plannedMinutes: 120,
          startedAt: NOW,
        }),
        step({
          workOrderId: "A",
          sequence: 2,
          workstationId: "ws2",
          status: "pending",
          plannedMinutes: 30,
        }),
      ],
      NOW,
    );
    const step1 = bars.find((b) => b.stepId === "A-1")!;
    const step2 = bars.find((b) => b.stepId === "A-2")!;
    expect(step2.start).toEqual(step1.end);
  });

  it("applies a minimum bar duration for zero-minute steps", () => {
    const bars = computeProductionSchedule(
      [
        step({
          workOrderId: "A",
          sequence: 1,
          workstationId: "ws1",
          plannedMinutes: 0,
        }),
      ],
      NOW,
    );
    expect(bars[0].end).toEqual(new Date(NOW.getTime() + 15 * 60_000));
  });

  it("carries through machine name when set", () => {
    const bars = computeProductionSchedule(
      [
        step({
          workOrderId: "A",
          sequence: 1,
          workstationId: "ws1",
          machineId: "m1",
          machineName: "Torno CNC 1",
        }),
      ],
      NOW,
    );
    expect(bars[0].machineName).toBe("Torno CNC 1");
  });

  it("returns an empty array when there are no steps", () => {
    expect(computeProductionSchedule([], NOW)).toEqual([]);
  });
});
