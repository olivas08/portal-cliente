import type { OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";

const config: Record<
  OrderStatus,
  { cls: string; dot: string; pulse?: boolean }
> = {
  pending: {
    cls: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
  production: {
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    pulse: true,
  },
  quality: {
    cls: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
    pulse: true,
  },
  shipped: {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    pulse: true,
  },
  delivered: {
    cls: "bg-teal-50 text-teal-700 border-teal-200",
    dot: "bg-teal-500",
  },
  cancelled: {
    cls: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { cls, dot, pulse } = config[status];
  const label = ORDER_STATUS_LABELS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dot} ${pulse ? "animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
}
