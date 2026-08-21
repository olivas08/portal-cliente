import Link from "next/link";
import { Activity, ArrowLeft, Timer, PauseOctagon } from "lucide-react";
import type { WorkstationOeeVM } from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";

interface Props {
  stations: WorkstationOeeVM[];
  factory: WorkstationOeeVM | null;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** OEE benchmark colouring: world-class ≥85%, acceptable ≥60%, else poor. */
function oeeColor(v: number): string {
  if (v >= 0.85) return "text-emerald-600";
  if (v >= 0.6) return "text-amber-600";
  return "text-red-600";
}

function barColor(v: number): string {
  if (v >= 0.85) return "bg-emerald-500";
  if (v >= 0.6) return "bg-amber-500";
  return "bg-red-500";
}

function Factor({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-700">{pct(value)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor(value)}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  );
}

function formatMin(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}min`;
}

export function WorkstationOeeView({ stations, factory }: Props) {
  const withData = stations.filter((s) => s.completedSteps > 0);

  return (
    <>
      <BreadcrumbSetter text="Desempenho" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <Activity size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Desempenho (OEE)</h1>
          <p className="text-sm text-slate-500">
            Eficiência global dos equipamentos: Disponibilidade × Desempenho ×
            Qualidade
          </p>
        </div>
        <Link
          href="/admin/producao"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Produção
        </Link>
      </div>

      {factory && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="text-center sm:border-r sm:border-slate-100 sm:pr-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
                OEE da fábrica
              </p>
              <p className={`text-5xl font-bold ${oeeColor(factory.oee)}`}>
                {pct(factory.oee)}
              </p>
              <div className="flex items-center justify-center gap-3 mt-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Timer size={12} /> {formatMin(factory.runtimeMinutes)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <PauseOctagon size={12} /> {formatMin(factory.downtimeMinutes)}
                </span>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Factor label="Disponibilidade" value={factory.availability} />
              <Factor label="Desempenho" value={factory.performance} />
              <Factor label="Qualidade" value={factory.quality} />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stations.map((ws) => (
          <div
            key={ws.id}
            className="bg-white rounded-xl shadow-sm border border-slate-100 p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">
                  {ws.name}
                </p>
                <p className="text-xs text-slate-400">{ws.clientStageLabel}</p>
              </div>
              {ws.completedSteps > 0 ? (
                <p className={`text-3xl font-bold ${oeeColor(ws.oee)}`}>
                  {pct(ws.oee)}
                </p>
              ) : (
                <p className="text-sm text-slate-300 font-medium">sem dados</p>
              )}
            </div>
            {ws.completedSteps > 0 && (
              <>
                <div className="flex flex-col gap-2.5">
                  <Factor label="Disponibilidade" value={ws.availability} />
                  <Factor label="Desempenho" value={ws.performance} />
                  <Factor label="Qualidade" value={ws.quality} />
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  {ws.completedSteps}{" "}
                  {ws.completedSteps === 1 ? "passo concluído" : "passos concluídos"}
                  {" · "}
                  {formatMin(ws.runtimeMinutes)} produção
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {withData.length === 0 && (
        <p className="text-sm text-slate-500 mt-4">
          Ainda não há passos concluídos para calcular OEE.
        </p>
      )}
    </>
  );
}
