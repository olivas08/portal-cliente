import { describe, it, expect } from "vitest";
import {
  elapsedMinutes,
  canStartStep,
  canPauseStep,
  canCompleteStep,
  canDeclareStepDone,
  canReworkStep,
  isStepReady,
  currentStep,
  rollUpWorkOrderStatus,
  workOrderProgress,
  deriveOrderStatusFromProduction,
  buildClientStages,
  computeOee,
  computeWipValueByWorkstation,
} from "@/services/production-status";
import type { StepStatus } from "@/lib/types";

const step = (sequence: number, status: StepStatus) => ({ sequence, status });

describe("elapsedMinutes", () => {
  it("returns 0 when not running", () => {
    expect(elapsedMinutes(null, new Date())).toBe(0);
  });

  it("computes minutes from the running interval", () => {
    const start = new Date("2026-07-21T10:00:00Z");
    const now = new Date("2026-07-21T10:30:00Z");
    expect(elapsedMinutes(start, now)).toBe(30);
  });

  it("never returns negative time", () => {
    const start = new Date("2026-07-21T10:30:00Z");
    const now = new Date("2026-07-21T10:00:00Z");
    expect(elapsedMinutes(start, now)).toBe(0);
  });
});

describe("step transition guards", () => {
  it("allows start only from pending or paused", () => {
    expect(canStartStep("pending")).toBe(true);
    expect(canStartStep("paused")).toBe(true);
    expect(canStartStep("in_progress")).toBe(false);
    expect(canStartStep("done")).toBe(false);
  });

  it("allows pause only while in progress", () => {
    expect(canPauseStep("in_progress")).toBe(true);
    expect(canPauseStep("pending")).toBe(false);
  });

  it("allows complete from in_progress or paused", () => {
    expect(canCompleteStep("in_progress")).toBe(true);
    expect(canCompleteStep("paused")).toBe(true);
    expect(canCompleteStep("pending")).toBe(false);
    expect(canCompleteStep("done")).toBe(false);
  });

  it("allows office declaration from pending, in_progress or paused", () => {
    expect(canDeclareStepDone("pending")).toBe(true);
    expect(canDeclareStepDone("in_progress")).toBe(true);
    expect(canDeclareStepDone("paused")).toBe(true);
    expect(canDeclareStepDone("done")).toBe(false);
  });

  it("allows rework only from a completed step", () => {
    expect(canReworkStep("done")).toBe(true);
    expect(canReworkStep("in_progress")).toBe(false);
    expect(canReworkStep("paused")).toBe(false);
    expect(canReworkStep("pending")).toBe(false);
  });
});

describe("isStepReady", () => {
  const steps = [step(1, "done"), step(2, "pending"), step(3, "pending")];

  it("is ready when all earlier steps are done", () => {
    expect(isStepReady(steps[1], steps)).toBe(true);
  });

  it("is not ready when an earlier step is unfinished", () => {
    expect(isStepReady(steps[2], steps)).toBe(false);
  });

  it("is never ready when already done", () => {
    expect(isStepReady(step(2, "done"), steps)).toBe(false);
  });
});

describe("currentStep", () => {
  it("returns the first not-done step by sequence", () => {
    const steps = [step(2, "pending"), step(1, "done"), step(3, "pending")];
    expect(currentStep(steps)?.sequence).toBe(2);
  });

  it("returns null when everything is done", () => {
    expect(currentStep([step(1, "done"), step(2, "done")])).toBeNull();
  });
});

describe("rollUpWorkOrderStatus", () => {
  it("keeps planned until released", () => {
    expect(rollUpWorkOrderStatus("planned", [step(1, "in_progress")])).toBe(
      "planned",
    );
  });

  it("is released when nothing started yet", () => {
    expect(rollUpWorkOrderStatus("released", [step(1, "pending")])).toBe(
      "released",
    );
  });

  it("is in_progress once any step started", () => {
    expect(
      rollUpWorkOrderStatus("released", [step(1, "in_progress"), step(2, "pending")]),
    ).toBe("in_progress");
  });

  it("is done when all steps are done", () => {
    expect(
      rollUpWorkOrderStatus("in_progress", [step(1, "done"), step(2, "done")]),
    ).toBe("done");
  });

  it("never auto-changes a cancelled work order", () => {
    expect(
      rollUpWorkOrderStatus("cancelled", [step(1, "done"), step(2, "done")]),
    ).toBe("cancelled");
    expect(
      rollUpWorkOrderStatus("cancelled", [step(1, "in_progress")]),
    ).toBe("cancelled");
  });
});

describe("workOrderProgress", () => {
  it("is 0 with no steps", () => {
    expect(workOrderProgress([])).toBe(0);
  });

  it("is the done ratio", () => {
    expect(
      workOrderProgress([step(1, "done"), step(2, "done"), step(3, "pending")]),
    ).toBeCloseTo(2 / 3);
  });
});

describe("deriveOrderStatusFromProduction", () => {
  it("advances pending → production when work starts", () => {
    expect(
      deriveOrderStatusFromProduction("pending", [{ status: "in_progress" }]),
    ).toBe("production");
  });

  it("advances production → quality when all work orders are done", () => {
    expect(
      deriveOrderStatusFromProduction("production", [
        { status: "done" },
        { status: "done" },
      ]),
    ).toBe("quality");
  });

  it("does not advance to quality while work remains", () => {
    expect(
      deriveOrderStatusFromProduction("production", [
        { status: "done" },
        { status: "in_progress" },
      ]),
    ).toBeNull();
  });

  it("never overrides shipped/delivered/cancelled", () => {
    expect(
      deriveOrderStatusFromProduction("shipped", [{ status: "done" }]),
    ).toBeNull();
    expect(
      deriveOrderStatusFromProduction("cancelled", [{ status: "in_progress" }]),
    ).toBeNull();
  });

  it("returns null with no work orders", () => {
    expect(deriveOrderStatusFromProduction("pending", [])).toBeNull();
  });

  it("ignores cancelled work orders when deriving status", () => {
    expect(
      deriveOrderStatusFromProduction("production", [
        { status: "done" },
        { status: "cancelled" },
      ]),
    ).toBe("quality");
  });

  it("returns null when every work order is cancelled", () => {
    expect(
      deriveOrderStatusFromProduction("production", [
        { status: "cancelled" },
        { status: "cancelled" },
      ]),
    ).toBeNull();
  });
});

describe("buildClientStages", () => {
  it("orders stages by station sequence and marks state", () => {
    const stages = buildClientStages([
      { clientStageLabel: "Corte", stationSequence: 1, stepStatus: "done" },
      { clientStageLabel: "Maquinação", stationSequence: 2, stepStatus: "in_progress" },
      { clientStageLabel: "Acabamento", stationSequence: 3, stepStatus: "pending" },
    ]);
    expect(stages).toEqual([
      { label: "Corte", state: "done" },
      { label: "Maquinação", state: "current" },
      { label: "Acabamento", state: "upcoming" },
    ]);
  });

  it("groups multiple steps sharing a stage label", () => {
    const stages = buildClientStages([
      { clientStageLabel: "Maquinação", stationSequence: 2, stepStatus: "done" },
      { clientStageLabel: "Maquinação", stationSequence: 3, stepStatus: "pending" },
      { clientStageLabel: "Corte", stationSequence: 1, stepStatus: "done" },
    ]);
    expect(stages).toEqual([
      { label: "Corte", state: "done" },
      { label: "Maquinação", state: "current" },
    ]);
  });
});

describe("computeOee", () => {
  it("returns all-zero factors with no data", () => {
    const r = computeOee([]);
    expect(r.availability).toBe(0);
    expect(r.performance).toBe(0);
    expect(r.quality).toBe(0);
    expect(r.oee).toBe(0);
  });

  it("computes A×P×Q from aggregated steps", () => {
    // runtime 90, downtime 10 -> A = 0.9
    // planned 72 / runtime 90 -> P = 0.8
    // good 95 / (95+5) -> Q = 0.95
    const r = computeOee([
      {
        plannedMinutes: 72,
        actualMinutes: 90,
        downtimeMinutes: 10,
        quantityDone: 95,
        scrapQty: 5,
      },
    ]);
    expect(r.availability).toBeCloseTo(0.9);
    expect(r.performance).toBeCloseTo(0.8);
    expect(r.quality).toBeCloseTo(0.95);
    expect(r.oee).toBeCloseTo(0.9 * 0.8 * 0.95);
  });

  it("caps performance at 100% when faster than planned", () => {
    const r = computeOee([
      {
        plannedMinutes: 120,
        actualMinutes: 60,
        downtimeMinutes: 0,
        quantityDone: 10,
        scrapQty: 0,
      },
    ]);
    expect(r.performance).toBe(1);
    expect(r.availability).toBe(1);
    expect(r.quality).toBe(1);
  });

  it("aggregates multiple steps before dividing", () => {
    const r = computeOee([
      { plannedMinutes: 30, actualMinutes: 40, downtimeMinutes: 0, quantityDone: 8, scrapQty: 2 },
      { plannedMinutes: 30, actualMinutes: 40, downtimeMinutes: 20, quantityDone: 10, scrapQty: 0 },
    ]);
    // runtime 80, downtime 20 -> A 0.8; planned 60/80 -> P 0.75; good 18/20 -> Q 0.9
    expect(r.availability).toBeCloseTo(0.8);
    expect(r.performance).toBeCloseTo(0.75);
    expect(r.quality).toBeCloseTo(0.9);
  });
});

describe("computeWipValueByWorkstation", () => {
  it("values a work order at its remaining quantity times unit price, attributed to the current step's workstation", () => {
    const result = computeWipValueByWorkstation([
      {
        quantityPlanned: 10,
        quantityDone: 4,
        unitPriceEur: 25,
        steps: [
          { sequence: 1, status: "done", workstationId: "ws1", workstationName: "Corte" },
          { sequence: 2, status: "in_progress", workstationId: "ws2", workstationName: "Maquinação" },
        ],
      },
    ]);
    expect(result).toEqual([
      { workstationId: "ws2", workstationName: "Maquinação", valueEur: 150, orderCount: 1 },
    ]);
  });

  it("aggregates several work orders currently sitting at the same workstation", () => {
    const result = computeWipValueByWorkstation([
      {
        quantityPlanned: 5,
        quantityDone: 0,
        unitPriceEur: 10,
        steps: [{ sequence: 1, status: "pending", workstationId: "ws1", workstationName: "Corte" }],
      },
      {
        quantityPlanned: 3,
        quantityDone: 1,
        unitPriceEur: 20,
        steps: [{ sequence: 1, status: "pending", workstationId: "ws1", workstationName: "Corte" }],
      },
    ]);
    expect(result).toEqual([
      { workstationId: "ws1", workstationName: "Corte", valueEur: 90, orderCount: 2 },
    ]);
  });

  it("sorts workstations by value descending", () => {
    const result = computeWipValueByWorkstation([
      {
        quantityPlanned: 1,
        quantityDone: 0,
        unitPriceEur: 10,
        steps: [{ sequence: 1, status: "pending", workstationId: "small", workstationName: "Pequeno" }],
      },
      {
        quantityPlanned: 1,
        quantityDone: 0,
        unitPriceEur: 1000,
        steps: [{ sequence: 1, status: "pending", workstationId: "big", workstationName: "Grande" }],
      },
    ]);
    expect(result.map((w) => w.workstationId)).toEqual(["big", "small"]);
  });

  it("skips work orders with no active step (all steps done)", () => {
    const result = computeWipValueByWorkstation([
      {
        quantityPlanned: 5,
        quantityDone: 5,
        unitPriceEur: 10,
        steps: [{ sequence: 1, status: "done", workstationId: "ws1", workstationName: "Corte" }],
      },
    ]);
    expect(result).toEqual([]);
  });

  it("never produces a negative value when quantityDone exceeds quantityPlanned", () => {
    const result = computeWipValueByWorkstation([
      {
        quantityPlanned: 5,
        quantityDone: 8,
        unitPriceEur: 10,
        steps: [{ sequence: 1, status: "in_progress", workstationId: "ws1", workstationName: "Corte" }],
      },
    ]);
    expect(result[0].valueEur).toBe(0);
  });

  it("returns an empty array for no work orders", () => {
    expect(computeWipValueByWorkstation([])).toEqual([]);
  });
});
