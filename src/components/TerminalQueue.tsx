"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, CheckCircle2, Package, AlertCircle, AlertTriangle, Cpu } from "lucide-react";
import type { TerminalStepVM } from "@/lib/types";
import { STEP_STATUS_LABELS } from "@/lib/types";
import {
  startStepAction,
  pauseStepAction,
  completeStepAction,
} from "@/actions/production";
import { actionError } from "@/lib/action-result";

interface Props {
  queue: TerminalStepVM[];
  operatorName: string;
}

export function TerminalQueue({ queue }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  // Live refresh so machine-reported counts appear without operator action.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fn();
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          return;
        }
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

          {step.machineName && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2">
              <Cpu size={14} className="text-emerald-400 shrink-0" />
              <span className="text-xs text-slate-300">
                {step.machineName}
                {step.machineVerified ? (
                  <>
                    {" · "}
                    <span className="font-bold text-emerald-400 tabular-nums">
                      {step.quantityDone}
                    </span>{" "}
                    registadas pela máquina
                  </>
                ) : (
                  " ligada"
                )}
              </span>
            </div>
          )}

          {completing === step.stepId ? (
            <CompleteForm
              defaultQty={step.quantityPlanned}
              machineVerified={step.machineVerified}
              machineQty={step.quantityDone}
              pending={pending}
              onCancel={() => setCompleting(null)}
              onConfirm={(quantityDone, scrapQty, defect) =>
                run(
                  () =>
                    completeStepAction({
                      stepId: step.stepId,
                      quantityDone,
                      scrapQty,
                      defect,
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
  machineVerified,
  machineQty,
  pending,
  onCancel,
  onConfirm,
}: {
  defaultQty: number;
  machineVerified: boolean;
  machineQty: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (
    quantityDone: number,
    scrapQty: number,
    defect?: { quantity: number; reason: string; disposition: "rework" | "scrap" },
  ) => void;
}) {
  const [qty, setQty] = useState(String(defaultQty));
  const [scrap, setScrap] = useState("0");
  const [ncOpen, setNcOpen] = useState(false);
  const [ncQty, setNcQty] = useState("1");
  const [ncReason, setNcReason] = useState("");
  const [ncDisposition, setNcDisposition] = useState<"rework" | "scrap">(
    "rework",
  );

  const ncInvalid = ncOpen && (Number(ncQty) <= 0 || ncReason.trim() === "");

  const submit = () => {
    const defect =
      ncOpen && !ncInvalid
        ? {
            quantity: Number(ncQty) || 0,
            reason: ncReason.trim(),
            disposition: ncDisposition,
          }
        : undefined;
    onConfirm(Number(qty) || 0, Number(scrap) || 0, defect);
  };

  return (
    <div className="mt-3 rounded-lg bg-slate-900 border border-slate-700 p-3">
      {machineVerified && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          <Cpu size={14} className="mt-0.5 shrink-0" />
          <span>
            Contagem confirmada pela máquina:{" "}
            <span className="font-bold tabular-nums">{machineQty}</span>{" "}
            conformes. A sua contagem serve apenas de confirmação.
          </span>
        </div>
      )}
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

      {!ncOpen ? (
        <button
          type="button"
          onClick={() => setNcOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-300 hover:text-red-200"
        >
          <AlertTriangle size={14} /> Registar não conforme
        </button>
      ) : (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300">
              <AlertTriangle size={14} /> Não-conformidade
            </span>
            <button
              type="button"
              onClick={() => setNcOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Remover
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Qtd. não conforme
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={ncQty}
                onChange={(e) => setNcQty(e.target.value)}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </label>
            <label className="text-xs text-slate-400">
              Destino
              <select
                value={ncDisposition}
                onChange={(e) =>
                  setNcDisposition(e.target.value as "rework" | "scrap")
                }
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="rework">Reprocessar</option>
                <option value="scrap">Sucata</option>
              </select>
            </label>
          </div>
          <label className="text-xs text-slate-400 block mt-3">
            Motivo
            <input
              type="text"
              value={ncReason}
              onChange={(e) => setNcReason(e.target.value)}
              placeholder="Ex.: dimensão fora de tolerância"
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </label>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2.5 hover:bg-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={pending || ncInvalid}
          className="flex-1 rounded-lg bg-amber-500 text-slate-900 font-bold py-2.5 hover:bg-amber-400 disabled:opacity-60"
        >
          Confirmar conclusão
        </button>
      </div>
    </div>
  );
}
