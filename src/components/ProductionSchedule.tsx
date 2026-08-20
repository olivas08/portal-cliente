import Link from "next/link";
import { CalendarRange, ArrowLeft, Info } from "lucide-react";
import type { ScheduleWorkstationVM, ScheduleBarVM } from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";

interface Props {
  schedule: ScheduleWorkstationVM[];
  horizonDays: number;
}

const STEP_COLOR: Record<ScheduleBarVM["stepStatus"], string> = {
  pending: "bg-slate-300",
  in_progress: "bg-amber-400",
  paused: "bg-orange-300",
  done: "bg-emerald-400",
};

function dayLabel(date: Date): string {
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function tooltipFor(bar: ScheduleBarVM): string {
  const start = new Date(bar.start).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const end = new Date(bar.end).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const timeLabel = bar.isEstimate
    ? " (estimativa)"
    : bar.stepStatus === "in_progress"
      ? " (fim estimado)"
      : "";
  const lines = [
    `${bar.workOrderRef} · ${bar.productName}`,
    bar.companyName,
    `${bar.stepName}${bar.machineName ? ` · ${bar.machineName}` : ""}`,
    `${start} → ${end}${timeLabel}`,
  ];
  if (bar.workOrderStatus === "planned") lines.push("Ainda não lançada");
  return lines.join("\n");
}

export function ProductionSchedule({ schedule, horizonDays }: Props) {
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart.getTime() + horizonDays * 24 * 60 * 60_000);
  const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
  const nowPct = Math.min(
    100,
    Math.max(0, ((now.getTime() - rangeStart.getTime()) / rangeMs) * 100),
  );

  const days = Array.from({ length: horizonDays }, (_, i) => {
    const d = new Date(rangeStart.getTime() + i * 24 * 60 * 60_000);
    return { date: d, pct: (i / horizonDays) * 100 };
  });

  const activeWorkstations = schedule.filter((ws) => ws.bars.length > 0);
  const totalBars = schedule.reduce((sum, ws) => sum + ws.bars.length, 0);

  return (
    <>
      <BreadcrumbSetter text="Planeamento" />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <CalendarRange size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Planeamento</h1>
          <p className="text-sm text-slate-500">
            Projeção da fila de produção por posto nas próximas{" "}
            {horizonDays} dias
          </p>
        </div>
        <Link
          href="/admin/producao"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Produção
        </Link>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 mb-5 text-sm text-sky-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        <p>
          Esta vista é uma <strong>estimativa</strong>: mostra como a fila
          atual (por prioridade e ordem de chegada) ocuparia cada posto se
          for processada sem interrupções. Não é uma reserva fixa de tempo —
          as ordens continuam a ser trabalhadas pela fila normal no terminal
          de chão de fábrica.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        {totalBars === 0 ? (
          <p className="text-sm text-slate-500">
            Sem ordens de fabrico em fila para os próximos {horizonDays} dias.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="relative h-6 mb-2 ml-40">
                {days.map((d) => (
                  <span
                    key={d.date.toISOString()}
                    className="absolute text-[11px] text-slate-400 -translate-x-1/2"
                    style={{ left: `${d.pct}%` }}
                  >
                    {dayLabel(d.date)}
                  </span>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {activeWorkstations.map((ws) => (
                  <div key={ws.id} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {ws.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {ws.clientStageLabel}
                      </p>
                    </div>
                    <div className="relative flex-1 h-8 rounded-lg bg-slate-50 border border-slate-100">
                      {days.map((d) => (
                        <div
                          key={d.date.toISOString()}
                          className="absolute top-0 bottom-0 border-l border-slate-100"
                          style={{ left: `${d.pct}%` }}
                        />
                      ))}
                      <div
                        className="absolute top-0 bottom-0 border-l-2 border-red-400"
                        style={{ left: `${nowPct}%` }}
                      />
                      {ws.bars.map((bar) => {
                        const start = new Date(bar.start).getTime();
                        const end = new Date(bar.end).getTime();
                        const left = Math.max(
                          0,
                          ((start - rangeStart.getTime()) / rangeMs) * 100,
                        );
                        const right = Math.min(
                          100,
                          ((end - rangeStart.getTime()) / rangeMs) * 100,
                        );
                        const width = Math.max(0.5, right - left);
                        return (
                          <div
                            key={bar.stepId}
                            title={tooltipFor(bar)}
                            className={`absolute top-1 bottom-1 rounded ${STEP_COLOR[bar.stepStatus]} ${
                              bar.workOrderStatus === "planned"
                                ? "opacity-50 border border-dashed border-slate-400"
                                : ""
                            } ${bar.priority === "urgent" ? "ring-2 ring-red-400" : ""}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-300" /> Em espera
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-400" /> Em curso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-300" /> Pausado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded opacity-50 border border-dashed border-slate-400 bg-slate-300" />{" "}
          Ainda não lançada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-300 ring-2 ring-red-400" />{" "}
          Urgente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-3 bg-red-400" /> Agora
        </span>
      </div>
    </>
  );
}
