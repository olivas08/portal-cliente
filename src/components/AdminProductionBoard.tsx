"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Factory, Rocket, Plus, AlertCircle, CircleDot, CheckCircle2, Circle, PauseCircle } from "lucide-react";
import type { WorkOrderVM, WorkOrderStatus, StepStatus } from "@/lib/types";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/types";
import { generateWorkOrders, releaseWorkOrder } from "@/actions/production";
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
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  const byStatus = (status: WorkOrderStatus) =>
    workOrders.filter((wo) => wo.status === status);

  return (
    <>
      <BreadcrumbSetter text="Produção" />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <Factory size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Produção</h1>
          <p className="text-sm text-slate-500">
            Ordens de fabrico e progresso no chão de fábrica
          </p>
        </div>
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

                  {wo.status === "planned" && (
                    <button
                      onClick={() => run(() => releaseWorkOrder(wo.id))}
                      disabled={pending}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold px-3 py-2 hover:bg-sky-500 disabled:opacity-60"
                    >
                      <Rocket size={14} /> Lançar para produção
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
