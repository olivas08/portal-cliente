/**
 * Display formatters shared by the UI. Dates that are already ISO calendar
 * dates (`YYYY-MM-DD`) stay in `dates.ts`; this module covers money and
 * Date-time instants.
 */

/** Portuguese euro amount (`1 234,56 €`). */
export function formatEur(value: number): string {
  return `${value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

/** Portuguese calendar date from an ISO datetime or date string. */
export function formatInstantPt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT");
}

/** Short Portuguese date+time (`14/09, 11:44`). */
export function formatDateTimePt(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relative time in Portuguese (`há 3 min`, `há 2 h`, `há 4 d`). */
export function formatRelativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "nunca";
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return "agora";
  if (seconds < 60) return `há ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return formatInstantPt(iso);
}
