import Link from "next/link";
import { Gauge, ArrowLeft, Layers, Clock } from "lucide-react";
import type { WorkstationLoadVM } from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";

interface Props {
  load: WorkstationLoadVM[];
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function WorkstationCapacity({ load }: Props) {
  const maxTotal = Math.max(1, ...load.map((w) => w.totalMinutes));
  const totalBacklog = load.reduce((sum, w) => sum + w.totalMinutes, 0);
  const busiest = load.reduce<WorkstationLoadVM | null>(
    (top, w) => (top && top.totalMinutes >= w.totalMinutes ? top : w),
    null,
  );

  return (
    <>
      <BreadcrumbSetter text="Capacidade" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <Gauge size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Capacidade</h1>
          <p className="text-sm text-slate-500">
            Carga de trabalho por posto no chão de fábrica
          </p>
        </div>
        <Link
          href="/admin/producao"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Produção
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Clock size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">
              Backlog total
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {formatHours(totalBacklog)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Layers size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">
              Postos ativos
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{load.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Gauge size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">
              Posto mais carregado
            </span>
          </div>
          <p className="text-lg font-bold text-slate-800 truncate">
            {busiest && busiest.totalMinutes > 0 ? busiest.name : "—"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        {load.length === 0 ? (
          <p className="text-sm text-slate-500">
            Sem postos de trabalho ativos.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {load.map((ws) => {
              const width = (ws.totalMinutes / maxTotal) * 100;
              const activePct =
                ws.totalMinutes > 0
                  ? (ws.activeMinutes / ws.totalMinutes) * 100
                  : 0;
              return (
                <div key={ws.id}>
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 text-sm">
                        {ws.name}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        {ws.clientStageLabel}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 shrink-0">
                      {formatHours(ws.totalMinutes)}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-300"
                      style={{ width: `${width}%` }}
                    >
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${activePct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    <span>
                      {ws.workOrderCount}{" "}
                      {ws.workOrderCount === 1 ? "ordem" : "ordens"}
                    </span>
                    <span>·</span>
                    <span>
                      {ws.stepCount} {ws.stepCount === 1 ? "passo" : "passos"}
                    </span>
                    <span>·</span>
                    <span className="text-emerald-600 font-medium">
                      {ws.readyCount} prontos
                    </span>
                    {ws.activeMinutes > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-amber-600 font-medium">
                          {formatHours(ws.activeMinutes)} em curso
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
