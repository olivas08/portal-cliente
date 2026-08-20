import type { MaintenanceStatus } from "@/lib/types";

/**
 * Pure, side-effect-free machine maintenance helpers. Take plain structural
 * inputs (never Prisma clients) so the due-date/urgency math is
 * unit-testable in isolation, mirroring `production-status.ts`.
 */

export type MaintenanceUrgency = "overdue" | "due_soon" | "ok";

const DUE_SOON_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Next due date for a recurring plan: `intervalDays` after the last time it
 * was done, or after the plan was created if it has never been done yet.
 */
export function computeNextDueDate(
  lastDoneAt: Date | null,
  createdAt: Date,
  intervalDays: number,
): Date {
  const anchor = lastDoneAt ?? createdAt;
  return new Date(anchor.getTime() + intervalDays * MS_PER_DAY);
}

/** Classifies how urgent a due date is relative to `now`. */
export function maintenanceUrgency(
  dueDate: Date,
  now: Date,
  dueSoonDays: number = DUE_SOON_DAYS,
): MaintenanceUrgency {
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / MS_PER_DAY;
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= dueSoonDays) return "due_soon";
  return "ok";
}

/**
 * A task has no separate "in_progress" status (only open/resolved/cancelled)
 * — `startedAt` is an optional, purely informational timestamp on an open
 * task. It can only be stamped once, while the task is still open.
 */
export function canStartMaintenanceTask(
  status: MaintenanceStatus,
  startedAt: Date | null,
): boolean {
  return status === "open" && startedAt === null;
}

/** An open task (started or not) can be resolved. */
export function canResolveMaintenanceTask(status: MaintenanceStatus): boolean {
  return status === "open";
}

/** Only an open task can be cancelled (e.g. a breakdown reported by mistake). */
export function canCancelMaintenanceTask(status: MaintenanceStatus): boolean {
  return status === "open";
}
