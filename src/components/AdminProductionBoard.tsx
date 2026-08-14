"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionError } from "@/lib/action-result";
import Link from "next/link";
import { Factory, PlayCircle, Plus, AlertCircle, CircleDot, CheckCircle2, Circle, PauseCircle, Ban, Trash2, Flame, Undo2, Route, Gauge, ShieldAlert, Activity, Cpu, PackageX } from "lucide-react";
import type { WorkOrderVM, WorkOrderStatus, StepStatus } from "@/lib/types";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/types";
import {
  generateWorkOrders,
  releaseWorkOrder,
  cancelWorkOrder,
  reopenWorkOrder,
  deleteWorkOrder,
  setWorkOrderPriority,
} from "@/actions/production";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";

interface UnplannedOrder {
  id: string;
  reference: string;
  clientCompany: string;
  itemCount: number;
}

interface Props {
  workOrders: WorkOrderVM[];
  unplanned: UnplannedOrder[];
}

const COLUMNS: { status: WorkOrderStatus; accent: string }[] = [
  { status: "planned", accent: "border-slate-300" },
  { status: "released", accent: "border-sky-400" },
  { status: "in_progress", accent: "border-amber-400" },
  { status: "done", accent: "border-emerald-400" },
];

const STEP_ICON: Record<StepStatus, typeof Circle> = {
  pending: Circle,
  in_progress: CircleDot,
  paused: PauseCircle,
  done: CheckCircle2,
};

const STEP_COLOR: Record<StepStatus, string> = {
  pending: "text-slate-300",
  in_progress: "text-amber-500",
  paused: "text-orange-400",
  done: "text-emerald-500",
};

export function AdminProductionBoard({ workOrders, unplanned }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fn();
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          return;
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  const byStatus = (status: WorkOrderStatus) =>
    workOrders.filter((wo) => wo.status === status);
  const cancelled = workOrders.filter((wo) => wo.status === "cancelled");

  return (
    <>
      <BreadcrumbSetter text="Produção" />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <Factory size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Produção</h1>
          <p className="text-sm text-slate-500">
            Ordens de fabrico e progresso no chão de fábrica
          </p>
        </div>
        <Link
          href="/admin/producao/oee"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Activity size={16} /> Desempenho
        </Link>
        <Link
          href="/admin/producao/qualidade"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ShieldAlert size={16} /> Qualidade
        </Link>
        <Link
          href="/admin/producao/capacidade"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Gauge size={16} /> Capacidade
        </Link>
        <Link
          href="/admin/producao/maquinas"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Cpu size={16} /> Máquinas
        </Link>
        <Link
          href="/admin/producao/roteiros"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Route size={16} /> Roteiros
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-5 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {unplanned.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-6">
          <h2 className="font-semibold text-slate-800 mb-1">
            Encomendas por planear
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Gere ordens de fabrico para começar a acompanhar a produção.
          </p>
          <div className="flex flex-col gap-2">
            {unplanned.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm">
                    {o.reference}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {o.clientCompany} · {o.itemCount}{" "}
                    {o.itemCount === 1 ? "artigo" : "artigos"}
                  </p>
                </div>
                <button
                  onClick={() => run(() => generateWorkOrders(o.id))}
                  disabled={pending}
                  className="flex items-center gap-1.5 shrink-0 rounded-lg bg-slate-800 text-white text-xs font-semibold px-3 py-2 hover:bg-slate-700 disabled:opacity-60"
                >
                  <Plus size={14} /> Gerar ordens
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map(({ status, accent }) => {
          const items = byStatus(status);
          return (
            <div key={status} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-slate-700">
                  {WORK_ORDER_STATUS_LABELS[status]}
                </h3>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                  {items.length}
                </span>
              </div>

              {items.length === 0 && (
                <p className="text-xs text-slate-400 px-1 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  Sem ordens
                </p>
              )}

              {items.map((wo) => (
                <div
                  key={wo.id}
                  className={`bg-white rounded-xl shadow-sm border-l-4 ${accent} border border-slate-100 p-4`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800 text-sm">
                      {wo.reference}
                    </p>
                    {wo.priority === "urgent" && (
                      <span className="text-[9px] bg-amber-500 text-white font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full">
                        Urgente
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/admin/ordens/${wo.orderId}`}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    {wo.orderReference} · {wo.clientCompany}
                  </Link>

                  <p className="text-sm text-slate-700 mt-2">
                    {wo.productName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {wo.quantityPlanned} un planeadas
                  </p>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Progresso</span>
                      <span>{Math.round(wo.progress * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.round(wo.progress * 100)}%` }}
                      />
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1.5">
                    {wo.steps.map((step) => {
                      const Icon = STEP_ICON[step.status];
                      return (
                        <li
                          key={step.id}
                          className="flex items-center gap-2 text-xs text-slate-500"
                        >
                          <Icon size={13} className={STEP_COLOR[step.status]} />
                          <span className="flex-1 truncate">
                            {step.sequence}. {step.workstationName}
                          </span>
                          {step.operatorName && (
                            <span className="text-slate-300 truncate max-w-[70px]">
                              {step.operatorName}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {wo.status !== "done" && (
                    <div className="mt-3 flex items-center gap-2">
                      {wo.status === "planned" &&
                        (() => {
                          const blocked =
                            wo.materialStatus.hasBom &&
                            !wo.materialStatus.canRelease;
                          const tip = blocked
                            ? "Stock insuficiente: " +
                              wo.materialStatus.shortfalls
                                .map(
                                  (s) =>
                                    `${s.reference} (faltam ${s.missingQty} ${s.unit})`,
                                )
                                .join(", ")
                            : undefined;
                          return (
                            <button
                              onClick={() => run(() => releaseWorkOrder(wo.id))}
                              disabled={pending || blocked}
                              title={tip}
                              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-2 disabled:opacity-60 ${
                                blocked
                                  ? "bg-red-50 text-red-600 border border-red-200 cursor-not-allowed"
                                  : "bg-sky-600 text-white hover:bg-sky-500"
                              }`}
                            >
                              {blocked ? (
                                <>
                                  <PackageX size={14} /> Sem stock
                                </>
                              ) : (
                                <>
                                  <PlayCircle size={14} /> Lançar
                                </>
                              )}
                            </button>
                          );
                        })()}

                      <button
                        onClick={() =>
                          run(() =>
                            setWorkOrderPriority(
                              wo.id,
                              wo.priority === "urgent" ? "normal" : "urgent",
                            ),
                          )
                        }
                        disabled={pending}
                        title={
                          wo.priority === "urgent"
                            ? "Repor prioridade normal"
                            : "Marcar como urgente"
                        }
                        className={`flex items-center justify-center rounded-lg border px-2.5 py-2 disabled:opacity-60 ${
                          wo.priority === "urgent"
                            ? "border-amber-300 bg-amber-50 text-amber-600"
                            : "border-slate-200 text-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        <Flame size={14} />
                      </button>

                      {wo.status === "planned" ? (
                        <button
                          onClick={() => run(() => deleteWorkOrder(wo.id))}
                          disabled={pending}
                          title="Eliminar ordem"
                          className="flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 px-2.5 py-2 hover:bg-red-50 hover:text-red-500 disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => run(() => cancelWorkOrder(wo.id))}
                          disabled={pending}
                          title="Cancelar ordem"
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-slate-500 px-2.5 py-2 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                        >
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {cancelled.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-500 mb-3">
            Ordens canceladas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {cancelled.map((wo) => (
              <div
                key={wo.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-500 line-through">
                    {wo.reference}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {wo.orderReference} · {wo.productName}
                  </p>
                </div>
                <button
                  onClick={() => run(() => reopenWorkOrder(wo.id))}
                  disabled={pending}
                  className="flex items-center gap-1.5 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold px-3 py-2 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Undo2 size={14} /> Reabrir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
