import type { OrderVM } from "@/lib/types";

export interface MonthlyKpiPoint {
  /** "YYYY-MM", grouped by delivery month. */
  month: string;
  delivered: number;
  avgLeadTimeDays: number | null;
  /** 0-100, share of that month's deliveries that met the agreed deadline. */
  onTimeRate: number | null;
}

export interface OrderKpis {
  totalOrders: number;
  deliveredCount: number;
  inProgressCount: number;
  urgentInProgressCount: number;
  /** Average days between order creation and delivery, across all delivered orders. */
  avgLeadTimeDays: number | null;
  /** 0-100, share of delivered orders that met the agreed deadline. */
  onTimeDeliveryRate: number | null;
  /** Chronological series (oldest first) for the "ao longo do tempo" trend. */
  monthly: MonthlyKpiPoint[];
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const ms = new Date(toYmd).getTime() - new Date(fromYmd).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function onTimeRate(orders: OrderVM[]): number | null {
  if (orders.length === 0) return null;
  const onTime = orders.filter(
    (o) => o.deliveredDate && o.deliveredDate <= o.expectedDate
  ).length;
  return (onTime / orders.length) * 100;
}

/**
 * Pure aggregation of an order list into the KPI cards + trend chart shown
 * on the admin "Desempenho" page. Kept side-effect-free and framework-free
 * so it can be unit tested without touching Prisma or the DOM.
 */
export function computeOrderKpis(orders: OrderVM[]): OrderKpis {
  const delivered = orders.filter(
    (o) => o.status === "delivered" && o.deliveredDate
  );
  const inProgress = orders.filter((o) => o.status !== "delivered");
  const urgentInProgress = inProgress.filter((o) => o.priority === "urgent");

  const leadTimes = delivered.map((o) =>
    daysBetween(o.createdDate, o.deliveredDate!)
  );

  const byMonth = new Map<string, OrderVM[]>();
  for (const o of delivered) {
    const month = o.deliveredDate!.slice(0, 7);
    const group = byMonth.get(month);
    if (group) group.push(o);
    else byMonth.set(month, [o]);
  }

  const monthly: MonthlyKpiPoint[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, group]) => ({
      month,
      delivered: group.length,
      avgLeadTimeDays: average(
        group.map((o) => daysBetween(o.createdDate, o.deliveredDate!))
      ),
      onTimeRate: onTimeRate(group),
    }));

  return {
    totalOrders: orders.length,
    deliveredCount: delivered.length,
    inProgressCount: inProgress.length,
    urgentInProgressCount: urgentInProgress.length,
    avgLeadTimeDays: average(leadTimes),
    onTimeDeliveryRate: onTimeRate(delivered),
    monthly,
  };
}
