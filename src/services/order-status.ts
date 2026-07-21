import type { OrderStatus } from "@/lib/types";

/**
 * The canonical order lifecycle, in progress order. The admin UI intentionally
 * allows jumping to any stage (to correct mistakes), so this sequence is used
 * for sorting/derivation rather than to forbid transitions.
 */
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  "pending",
  "production",
  "quality",
  "shipped",
  "delivered",
];

const PRE_SHIPMENT: OrderStatus[] = ["pending", "production", "quality"];

/**
 * Pure derivation of the shipped/delivered timestamps for a status change.
 * Kept side-effect free so it can be unit-tested directly, mirroring the
 * approach used for `computeOrderKpis`.
 *
 * - Moving to `shipped` stamps `shippedDate` and clears `deliveredDate`.
 * - Moving to `delivered` stamps `deliveredDate` and preserves `shippedDate`.
 * - Moving back to any pre-shipment stage clears both dates.
 */
export function computeStatusDates(
  nextStatus: OrderStatus,
  existing: { shippedDate: Date | null; deliveredDate: Date | null },
  now: Date,
): { shippedDate: Date | null; deliveredDate: Date | null } {
  const shippedDate =
    nextStatus === "shipped"
      ? now
      : PRE_SHIPMENT.includes(nextStatus)
      ? null
      : existing.shippedDate;
  const deliveredDate = nextStatus === "delivered" ? now : null;
  return { shippedDate, deliveredDate };
}
