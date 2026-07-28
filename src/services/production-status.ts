import type {
  WorkOrderStatus,
  StepStatus,
  OrderStatus,
  ClientStageVM,
} from "@/lib/types";

/**
 * Pure, side-effect-free production helpers. They take plain structural inputs
 * (never Prisma clients) so the whole production state machine is unit-testable
 * in isolation, mirroring `order-status.ts`.
 */

interface StepLike {
  sequence: number;
  status: StepStatus;
}

/** Minutes elapsed in the current running interval (0 when not running). */
export function elapsedMinutes(startedAt: Date | null, now: Date): number {
  if (!startedAt) return 0;
  return Math.max(0, (now.getTime() - startedAt.getTime()) / 60_000);
}

export function canStartStep(status: StepStatus): boolean {
  return status === "pending" || status === "paused";
}

export function canPauseStep(status: StepStatus): boolean {
  return status === "in_progress";
}

export function canCompleteStep(status: StepStatus): boolean {
  return status === "in_progress" || status === "paused";
}

/** Only a completed step can be reopened for rework (reprocessing). */
export function canReworkStep(status: StepStatus): boolean {
  return status === "done";
}

/**
 * A step is ready to be worked when every lower-sequence step of the same work
 * order is done and the step itself is not yet done (flow-shop routing).
 */
export function isStepReady(step: StepLike, steps: StepLike[]): boolean {
  if (step.status === "done") return false;
  return steps
    .filter((s) => s.sequence < step.sequence)
    .every((s) => s.status === "done");
}

/** The first not-done step by sequence (the work order's active step). */
export function currentStep<T extends StepLike>(steps: T[]): T | null {
  const sorted = [...steps].sort((a, b) => a.sequence - b.sequence);
  return sorted.find((s) => s.status !== "done") ?? null;
}

/**
 * Derives a work order's status from its steps. `planned` (not yet released to
 * the floor) is a manual gate and is never auto-changed here.
 */
export function rollUpWorkOrderStatus(
  current: WorkOrderStatus,
  steps: StepLike[],
): WorkOrderStatus {
  if (current === "planned") return "planned";
  if (current === "cancelled") return "cancelled";
  if (steps.length === 0) return current;
  if (steps.every((s) => s.status === "done")) return "done";
  const anyStarted = steps.some((s) => s.status !== "pending");
  return anyStarted ? "in_progress" : "released";
}

/** Completion ratio (0..1) of a set of steps. */
export function workOrderProgress(steps: StepLike[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.status === "done").length;
  return done / steps.length;
}

/**
 * Derives whether an order's status should advance based on production, or
 * `null` to leave it untouched. Only manages the pending → production → quality
 * span; shipped/delivered/cancelled are manual and never overridden.
 */
export function deriveOrderStatusFromProduction(
  orderStatus: OrderStatus,
  workOrders: { status: WorkOrderStatus }[],
): OrderStatus | null {
  // Cancelled work orders never block or drive the order's status.
  const active = workOrders.filter((w) => w.status !== "cancelled");
  if (active.length === 0) return null;
  const anyStarted = active.some(
    (w) => w.status === "in_progress" || w.status === "done",
  );
  const allDone = active.every((w) => w.status === "done");

  if (orderStatus === "pending" && anyStarted) return "production";
  if (orderStatus === "production" && allDone) return "quality";
  return null;
}

interface ClientStageInput {
  clientStageLabel: string;
  stationSequence: number;
  stepStatus: StepStatus;
}

/**
 * Collapses a work order's steps into the customer-facing stage stepper: one
 * entry per distinct workstation stage label, ordered by station sequence. A
 * stage is `done` when all its steps are done, `current` for the earliest
 * not-done stage, and `upcoming` after that. Machine/operator details are never
 * exposed — only the abstracted stage label.
 */
export function buildClientStages(inputs: ClientStageInput[]): ClientStageVM[] {
  const groups = new Map<string, { seq: number; statuses: StepStatus[] }>();
  for (const input of inputs) {
    const existing = groups.get(input.clientStageLabel);
    if (existing) {
      existing.seq = Math.min(existing.seq, input.stationSequence);
      existing.statuses.push(input.stepStatus);
    } else {
      groups.set(input.clientStageLabel, {
        seq: input.stationSequence,
        statuses: [input.stepStatus],
      });
    }
  }

  const ordered = [...groups.entries()].sort(
    (a, b) => a[1].seq - b[1].seq || a[0].localeCompare(b[0]),
  );

  let currentAssigned = false;
  return ordered.map(([label, group]) => {
    const allDone = group.statuses.every((s) => s === "done");
    if (allDone) return { label, state: "done" as const };
    if (!currentAssigned) {
      currentAssigned = true;
      return { label, state: "current" as const };
    }
    return { label, state: "upcoming" as const };
  });
}

/** Raw inputs for an OEE calculation, aggregated from completed steps. */
export interface OeeInput {
  plannedMinutes: number;
  actualMinutes: number;
  downtimeMinutes: number;
  quantityDone: number;
  scrapQty: number;
}

/** OEE factors, each 0..1. `oee` is the product of the three. */
export interface Oee {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  runtimeMinutes: number;
  downtimeMinutes: number;
}

/**
 * Overall Equipment Effectiveness = Availability × Performance × Quality.
 * - Availability = runtime / (runtime + downtime)
 * - Performance  = planned / runtime (capped at 100%: you can't be "more than
 *   fully" performant, even when you beat the standard time)
 * - Quality      = good / (good + scrap)
 * Returns all-zero factors when there is no production data.
 */
export function computeOee(steps: OeeInput[]): Oee {
  let planned = 0;
  let runtime = 0;
  let downtime = 0;
  let good = 0;
  let scrap = 0;
  for (const s of steps) {
    planned += s.plannedMinutes;
    runtime += s.actualMinutes;
    downtime += s.downtimeMinutes;
    good += s.quantityDone;
    scrap += s.scrapQty;
  }

  const availability = runtime + downtime > 0 ? runtime / (runtime + downtime) : 0;
  const performance = runtime > 0 ? Math.min(1, planned / runtime) : 0;
  const quality = good + scrap > 0 ? good / (good + scrap) : 0;

  return {
    availability,
    performance,
    quality,
    oee: availability * performance * quality,
    runtimeMinutes: runtime,
    downtimeMinutes: downtime,
  };
}

export interface Discrepancy {
  declaredQty: number;
  machineQty: number;
  delta: number;
  absDelta: number;
  pct: number;
  flagged: boolean;
}

/**
 * Compares what an operator declared against what the machine actually
 * counted. The machine value is the source of truth; a positive delta means
 * the operator over-declared. `pct` is relative to the machine count.
 */
export function computeDiscrepancy(
  declaredQty: number,
  machineQty: number,
): Discrepancy {
  const delta = declaredQty - machineQty;
  const absDelta = Math.abs(delta);
  const pct = machineQty > 0 ? absDelta / machineQty : declaredQty > 0 ? 1 : 0;
  return {
    declaredQty,
    machineQty,
    delta,
    absDelta,
    pct,
    flagged: absDelta > 0,
  };
}

/** True when the machine has reported within the freshness window. */
export function isMachineOnline(
  lastSeenAt: Date | null,
  now: Date,
  windowSeconds = 60,
): boolean {
  if (!lastSeenAt) return false;
  return now.getTime() - lastSeenAt.getTime() <= windowSeconds * 1000;
}

export type MachineState = "run" | "idle" | "down" | "offline";

/**
 * Minutes of downtime to bank onto the active step when a machine resumes
 * running. Downtime accrues only while the machine was idle/down with a job
 * open, measured from when that non-running state began.
 */
export function downtimeOnResume(
  prevState: MachineState,
  stateSince: Date | null,
  now: Date,
): number {
  if ((prevState === "idle" || prevState === "down") && stateSince) {
    return elapsedMinutes(stateSince, now);
  }
  return 0;
}

/** True when a machine state string represents a non-productive condition. */
export function isDownState(state: MachineState): boolean {
  return state === "idle" || state === "down";
}
