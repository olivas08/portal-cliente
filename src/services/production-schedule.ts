import type { Priority, StepStatus, WorkOrderStatus } from "@/lib/types";

/**
 * Pure, side-effect-free production-schedule projection. Mirrors the split
 * used by `production-status.ts`: no Prisma types here, only plain
 * structural inputs, so the queue-projection math is unit-testable in
 * isolation.
 *
 * There is no finite-capacity time-slot scheduler in this system today —
 * steps run in a priority/FIFO queue self-served by shop-floor operators.
 * This module does NOT change that; it only *projects* what the queue would
 * look like if each workstation worked its steps back-to-back in priority
 * order, so the result is always an estimate (`isEstimate: true`), never a
 * committed schedule.
 */

/** Minimum bar duration so zero/near-zero planned-minute steps stay visible. */
const MIN_DURATION_MINUTES = 15;
/** Minimum remaining time assumed for an overrunning in-progress step. */
const MIN_REMAINING_MINUTES = 15;

export interface ScheduleStepInput {
  workOrderId: string;
  workOrderRef: string;
  productRef: string;
  productName: string;
  companyName: string;
  priority: Priority;
  workOrderStatus: WorkOrderStatus;
  workOrderCreatedAt: Date;
  workOrderPlannedEnd: Date | null;
  stepId: string;
  sequence: number;
  name: string;
  workstationId: string;
  machineId: string | null;
  machineName: string | null;
  status: StepStatus;
  plannedMinutes: number;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface ScheduleBar {
  workstationId: string;
  workOrderId: string;
  workOrderRef: string;
  productRef: string;
  productName: string;
  companyName: string;
  priority: Priority;
  workOrderStatus: WorkOrderStatus;
  stepId: string;
  stepName: string;
  stepStatus: StepStatus;
  machineId: string | null;
  machineName: string | null;
  start: Date;
  end: Date;
  /** True unless this bar's start is an already-observed actual timestamp. */
  isEstimate: boolean;
}

/**
 * Orders work orders the same way the shop floor's dispatch queue does:
 * urgent first, then earliest due date, then oldest first (FIFO tie-break).
 */
function compareWorkOrders(
  a: ScheduleStepInput,
  b: ScheduleStepInput,
): number {
  if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
  const aEnd = a.workOrderPlannedEnd?.getTime() ?? Infinity;
  const bEnd = b.workOrderPlannedEnd?.getTime() ?? Infinity;
  if (aEnd !== bEnd) return aEnd - bEnd;
  return a.workOrderCreatedAt.getTime() - b.workOrderCreatedAt.getTime();
}

/**
 * Projects an estimated start/end for every not-yet-done step, by simulating
 * each workstation processing its steps back-to-back in dispatch-priority
 * order, while respecting that a work order's steps must run in `sequence`
 * order (a later step can't start before the earlier one of the same order
 * finishes, even if on a different workstation).
 */
export function computeProductionSchedule(
  steps: ScheduleStepInput[],
  now: Date,
): ScheduleBar[] {
  const byWorkOrder = new Map<string, ScheduleStepInput[]>();
  for (const step of steps) {
    const group = byWorkOrder.get(step.workOrderId) ?? [];
    group.push(step);
    byWorkOrder.set(step.workOrderId, group);
  }

  const workOrderOrder = [...byWorkOrder.values()]
    .map((group) => group[0])
    .sort(compareWorkOrders)
    .map((s) => s.workOrderId);

  const workstationFreeAt = new Map<string, number>();
  const bars: ScheduleBar[] = [];

  for (const workOrderId of workOrderOrder) {
    const group = [...(byWorkOrder.get(workOrderId) ?? [])].sort(
      (a, b) => a.sequence - b.sequence,
    );
    let workOrderCursor = now.getTime();

    for (const step of group) {
      if (step.status === "done") {
        if (step.finishedAt) {
          workOrderCursor = Math.max(workOrderCursor, step.finishedAt.getTime());
        }
        continue;
      }

      const wsFreeAt = workstationFreeAt.get(step.workstationId) ?? now.getTime();
      let start: number;
      let end: number;
      let isEstimate: boolean;

      if (step.status === "in_progress" && step.startedAt) {
        start = step.startedAt.getTime();
        const elapsedMs = Math.max(0, now.getTime() - start);
        const remainingMs = Math.max(
          step.plannedMinutes * 60_000 - elapsedMs,
          MIN_REMAINING_MINUTES * 60_000,
        );
        end = now.getTime() + remainingMs;
        isEstimate = false;
      } else {
        start = Math.max(workOrderCursor, wsFreeAt, now.getTime());
        const durationMs =
          Math.max(step.plannedMinutes, MIN_DURATION_MINUTES) * 60_000;
        end = start + durationMs;
        isEstimate = true;
      }

      workstationFreeAt.set(step.workstationId, end);
      workOrderCursor = end;

      bars.push({
        workstationId: step.workstationId,
        workOrderId: step.workOrderId,
        workOrderRef: step.workOrderRef,
        productRef: step.productRef,
        productName: step.productName,
        companyName: step.companyName,
        priority: step.priority,
        workOrderStatus: step.workOrderStatus,
        stepId: step.stepId,
        stepName: step.name,
        stepStatus: step.status,
        machineId: step.machineId,
        machineName: step.machineName,
        start: new Date(start),
        end: new Date(end),
        isEstimate,
      });
    }
  }

  return bars;
}
