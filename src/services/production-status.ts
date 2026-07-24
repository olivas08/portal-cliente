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
