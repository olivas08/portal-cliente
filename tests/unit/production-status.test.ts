import { describe, it, expect } from "vitest";
import {
  elapsedMinutes,
  canStartStep,
  canPauseStep,
  canCompleteStep,
  isStepReady,
  currentStep,
  rollUpWorkOrderStatus,
  workOrderProgress,
  deriveOrderStatusFromProduction,
  buildClientStages,
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
