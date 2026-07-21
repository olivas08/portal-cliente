/**
 * Centralised date helpers. Order/request view-models carry dates as ISO
 * strings ("YYYY-MM-DD"); these keep the machine format, the month grouping
 * key and the Portuguese display format in one place instead of scattered
 * `toISOString().slice(...)` / manual `split("-")` calls.
 */

/** Machine-readable ISO date (YYYY-MM-DD) from a `Date`. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Year-month key (YYYY-MM) from an ISO date string. */
export function isoMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Portuguese display date (DD/MM/YYYY) from an ISO date string. */
export function formatDatePt(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
