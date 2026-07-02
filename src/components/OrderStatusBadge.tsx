import type { OrderStatus } from "@/lib/types";

const config: Record<
  OrderStatus,
  { label: string; cls: string; dot: string; pulse?: boolean }
> = {
  pending: {
    label: "Pendente",
    cls: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
  production: {
    label: "Em Produção",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    pulse: true,
  },
  quality: {
    label: "Controlo Qualidade",
    cls: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
    pulse: true,
  },
  shipped: {
    label: "Expedido",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    pulse: true,
  },
  delivered: {
    label: "Entregue",
    cls: "bg-teal-50 text-teal-700 border-teal-200",
    dot: "bg-teal-500",
  },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, cls, dot, pulse } = config[status];
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
