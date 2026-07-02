import { Calendar } from "lucide-react";
import type { OrderVM } from "@/lib/types";

export function DatesCard({ order }: { order: OrderVM }) {
  const rows: { label: string; value?: string; highlight?: boolean; good?: boolean }[] = [
    { label: "Criada", value: order.createdDate },
    { label: "Prazo acordado", value: order.expectedDate, highlight: true },
    { label: "Expedição", value: order.shippedDate },
    { label: "Entrega", value: order.deliveredDate, good: true },
  ].filter((r) => r.value) as typeof rows;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Calendar size={16} className="text-slate-400" />
        Datas
      </h3>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex justify-between items-center gap-4 ${
              r.highlight
                ? "bg-accent-soft border border-amber-200 rounded-lg px-3 py-2"
                : "px-3 py-1"
            }`}
          >
            <span
              className={`text-xs uppercase tracking-wide ${
                r.highlight ? "text-amber-800 font-semibold" : "text-slate-400"
              }`}
            >
              {r.label}
            </span>
            <span
              className={`text-sm font-semibold ${
                r.highlight
                  ? "text-amber-900"
                  : r.good
                  ? "text-teal-600"
                  : "text-slate-700"
              }`}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
