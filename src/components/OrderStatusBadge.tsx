import type { OrderStatus } from "@/lib/types";

const config: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-slate-100 text-slate-600" },
  production: { label: "Em Produção", cls: "bg-blue-100 text-blue-700" },
  quality: { label: "Controlo Qualidade", cls: "bg-purple-100 text-purple-700" },
  shipped: { label: "Expedido", cls: "bg-amber-100 text-amber-700" },
  delivered: { label: "Entregue", cls: "bg-green-100 text-green-700" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, cls } = config[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
