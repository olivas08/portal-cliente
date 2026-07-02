import type { OrderStatus } from "@/lib/types";

const STAGES: { id: OrderStatus; label: string }[] = [
  { id: "pending", label: "Pendente" },
  { id: "production", label: "Em Produção" },
  { id: "quality", label: "Controlo Q." },
  { id: "shipped", label: "Expedido" },
  { id: "delivered", label: "Entregue" },
];

const stageIndex: Record<OrderStatus, number> = {
  pending: 0,
  production: 1,
  quality: 2,
  shipped: 3,
  delivered: 4,
};

export function StatusStepper({ status }: { status: OrderStatus }) {
  const current = stageIndex[status];
  return (
    <div className="flex items-center gap-0">
      {STAGES.map((stage, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={stage.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  done
                    ? "bg-accent border-accent text-brand"
                    : active
                    ? "bg-white border-brand text-brand"
                    : "bg-white border-slate-200 text-slate-300"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs text-center leading-tight hidden sm:block ${
                  active
                    ? "text-brand font-medium"
                    : done
                    ? "text-slate-600"
                    : "text-slate-300"
                }`}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-5 transition-colors ${
                  done ? "bg-accent" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
