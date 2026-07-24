"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, CheckCircle2, Package, AlertCircle } from "lucide-react";
import type { TerminalStepVM } from "@/lib/types";
import { STEP_STATUS_LABELS } from "@/lib/types";
import {
  startStepAction,
  pauseStepAction,
  completeStepAction,
} from "@/actions/production";

interface Props {
  queue: TerminalStepVM[];
  operatorName: string;
}

export function TerminalQueue({ queue }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  if (queue.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center text-slate-400">
        <Package size={28} className="mx-auto mb-2 text-slate-600" />
        Sem trabalho em fila neste posto.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {queue.map((step) => (
        <div
          key={step.stepId}
          className={`rounded-xl border bg-slate-800 p-4 ${
            step.status === "in_progress"
              ? "border-amber-500"
              : "border-slate-700"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold truncate">{step.productName}</p>
              <p className="text-xs text-slate-400">
                {step.orderReference} · {step.workOrderReference}
              </p>
            </div>
            <div className="text-right shrink-0">
              {step.priority === "urgent" && (
                <span className="text-[9px] bg-amber-500 text-slate-900 font-bold uppercase px-1.5 py-0.5 rounded-full">
                  Urgente
                </span>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {step.quantityPlanned} un
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="text-slate-300">
              {step.sequence}. {step.stepName}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                step.status === "in_progress"
                  ? "bg-amber-500/20 text-amber-300"
                  : step.status === "paused"
                    ? "bg-orange-500/20 text-orange-300"
                    : "bg-slate-700 text-slate-300"
              }`}
            >
              {STEP_STATUS_LABELS[step.status]}
            </span>
          </div>

          {completing === step.stepId ? (
            <CompleteForm
              defaultQty={step.quantityPlanned}
              pending={pending}
              onCancel={() => setCompleting(null)}
              onConfirm={(quantityDone, scrapQty) =>
                run(
                  () =>
                    completeStepAction({
                      stepId: step.stepId,
                      quantityDone,
                      scrapQty,
                    }),
                  () => setCompleting(null),
                )
              }
            />
          ) : (
            <div className="flex gap-2 mt-3">
              {(step.status === "pending" || step.status === "paused") && (
                <button
                  onClick={() => run(() => startStepAction(step.stepId))}
                  disabled={pending}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white font-semibold py-3 hover:bg-emerald-500 disabled:opacity-60"
                >
                  <Play size={16} />
                  {step.status === "paused" ? "Retomar" : "Iniciar"}
                </button>
              )}
              {step.status === "in_progress" && (
                <>
                  <button
                    onClick={() => run(() => pauseStepAction(step.stepId))}
                    disabled={pending}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-700 text-white font-semibold px-4 py-3 hover:bg-slate-600 disabled:opacity-60"
                  >
                    <Pause size={16} /> Pausar
                  </button>
                  <button
                    onClick={() => setCompleting(step.stepId)}
                    disabled={pending}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 text-slate-900 font-bold py-3 hover:bg-amber-400 disabled:opacity-60"
                  >
                    <CheckCircle2 size={16} /> Concluir
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CompleteForm({
  defaultQty,
  pending,
  onCancel,
  onConfirm,
}: {
  defaultQty: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (quantityDone: number, scrapQty: number) => void;
}) {
  const [qty, setQty] = useState(String(defaultQty));
  const [scrap, setScrap] = useState("0");

  return (
    <div className="mt-3 rounded-lg bg-slate-900 border border-slate-700 p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-400">
          Qtd. conforme
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </label>
        <label className="text-xs text-slate-400">
          Sucata
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={scrap}
            onChange={(e) => setScrap(e.target.value)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </label>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2.5 hover:bg-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(Number(qty) || 0, Number(scrap) || 0)}
          disabled={pending}
          className="flex-1 rounded-lg bg-amber-500 text-slate-900 font-bold py-2.5 hover:bg-amber-400 disabled:opacity-60"
        >
          Confirmar conclusão
        </button>
      </div>
    </div>
  );
}
