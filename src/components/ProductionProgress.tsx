import { Check, Loader2, Circle, Factory } from "lucide-react";
import type { OrderProductionVM } from "@/lib/types";
import { formatDatePt } from "@/lib/dates";

/**
 * Client-facing production progress: an abstracted stage stepper plus an
 * overall progress bar. Deliberately shows only customer-friendly stage labels
 * — never machine, workstation or operator details.
 */
export function ProductionProgress({
  production,
}: {
  production: OrderProductionVM;
}) {
  const percent = Math.round(production.progress * 100);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Factory size={18} className="text-slate-700" />
          <h2 className="font-semibold text-slate-800">Estado da Produção</h2>
        </div>
        <span className="text-sm font-semibold text-slate-700">{percent}%</span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-5">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="flex flex-wrap gap-x-6 gap-y-4">
        {production.stages.map((stage) => (
          <li key={stage.label} className="flex items-center gap-2">
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full ${
                stage.state === "done"
                  ? "bg-emerald-500 text-white"
                  : stage.state === "current"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-slate-100 text-slate-300"
              }`}
            >
              {stage.state === "done" ? (
                <Check size={14} />
              ) : stage.state === "current" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Circle size={10} />
              )}
            </span>
            <span
              className={`text-sm ${
                stage.state === "upcoming"
                  ? "text-slate-400"
                  : "text-slate-700 font-medium"
              }`}
            >
              {stage.label}
            </span>
          </li>
        ))}
      </ol>

      {production.estimatedCompletion && (
        <p className="text-xs text-slate-400 mt-4">
          Conclusão estimada: {formatDatePt(production.estimatedCompletion)}
        </p>
      )}
    </div>
  );
}
