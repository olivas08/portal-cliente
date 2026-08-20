"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Clock,
  TrendingUp,
  AlertTriangle,
  Package,
  Gauge,
  ShieldAlert,
  PackageX,
  Boxes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OrderKpis } from "@/lib/kpis";
import type { ProductionKpisVM } from "@/lib/types";

const BRAND = "#0f172a";
const ACCENT = "#f59e0b";

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const label = new Date(Number(year), Number(m) - 1, 1).toLocaleDateString(
    "pt-PT",
    { month: "short" }
  );
  return label.replace(".", "");
}

function KpiCard({
  icon: Icon,
  label,
  value,
  foot,
  chip,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  foot: string;
  chip: string;
}) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
          {label}
        </p>
        <span className={`p-1.5 rounded-lg ${chip}`}>
          <Icon size={15} />
        </span>
      </div>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
        {foot}
      </p>
    </div>
  );
}

export function AdminKpisView({
  kpis,
  production,
  factoryOee,
}: {
  kpis: OrderKpis;
  production: ProductionKpisVM;
  factoryOee: number | null;
}) {
  const chartData = kpis.monthly.map((m) => ({
    month: formatMonth(m.month),
    "Lead time médio (dias)": m.avgLeadTimeDays !== null ? Math.round(m.avgLeadTimeDays * 10) / 10 : null,
    "Entregas no prazo (%)": m.onTimeRate !== null ? Math.round(m.onTimeRate) : null,
    "Encomendas entregues": m.delivered,
  }));

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Desempenho</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Indicadores de operação, para acompanhar a evolução do serviço ao
          longo do tempo
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={Clock}
          label="Lead Time Médio"
          value={
            kpis.avgLeadTimeDays !== null
              ? `${kpis.avgLeadTimeDays.toFixed(1)}d`
              : "—"
          }
          foot="Criação até entrega"
          chip="bg-slate-800 text-white"
        />
        <KpiCard
          icon={TrendingUp}
          label="Entregas no Prazo"
          value={
            kpis.onTimeDeliveryRate !== null
              ? `${Math.round(kpis.onTimeDeliveryRate)}%`
              : "—"
          }
          foot={`${kpis.deliveredCount} entregue${kpis.deliveredCount !== 1 ? "s" : ""}`}
          chip="bg-teal-100 text-teal-700"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Urgentes em Curso"
          value={String(kpis.urgentInProgressCount)}
          foot={`${kpis.inProgressCount} em curso no total`}
          chip="bg-amber-100 text-amber-700"
        />
        <KpiCard
          icon={Package}
          label="Total de Encomendas"
          value={String(kpis.totalOrders)}
          foot={
            kpis.cancelledCount > 0
              ? `${kpis.cancelledCount} cancelada${kpis.cancelledCount !== 1 ? "s" : ""}`
              : "Registadas no portal"
          }
          chip="bg-brand text-white"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={Clock}
          label="Atraso Médio"
          value={
            kpis.avgDelayDays !== null ? `${kpis.avgDelayDays.toFixed(1)}d` : "—"
          }
          foot="Só entregas fora do prazo"
          chip="bg-red-100 text-red-700"
        />
        <KpiCard
          icon={ShieldAlert}
          label="Taxa de Sucata"
          value={
            production.scrapRatePct !== null
              ? `${production.scrapRatePct.toFixed(1)}%`
              : "—"
          }
          foot="Refugo sobre produção concluída"
          chip="bg-orange-100 text-orange-700"
        />
        <KpiCard
          icon={Gauge}
          label="OEE Médio"
          value={factoryOee !== null ? `${Math.round(factoryOee * 100)}%` : "—"}
          foot="Disponibilidade × Performance × Qualidade"
          chip="bg-sky-100 text-sky-700"
        />
        <KpiCard
          icon={PackageX}
          label="Paradas por Material"
          value={String(production.materialBlockedCount)}
          foot="Ordens sem stock suficiente para lançar"
          chip="bg-amber-100 text-amber-700"
        />
      </div>

      {production.wipByWorkstation.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Boxes size={16} className="text-slate-400" />
              Valor de WIP por posto
            </h2>
            <span className="text-sm font-semibold text-slate-700">
              {production.totalWipValueEur.toLocaleString("pt-PT", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              })}{" "}
              total
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {production.wipByWorkstation.map((ws) => {
              const maxValue = Math.max(
                1,
                ...production.wipByWorkstation.map((w) => w.valueEur),
              );
              const width = (ws.valueEur / maxValue) * 100;
              return (
                <div key={ws.workstationId}>
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <span className="font-medium text-slate-700 text-sm">
                      {ws.workstationName}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 shrink-0">
                      {ws.valueEur.toLocaleString("pt-PT", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })}
                      <span className="text-xs text-slate-400 font-normal ml-1.5">
                        {ws.orderCount}{" "}
                        {ws.orderCount === 1 ? "ordem" : "ordens"}
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-400"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h2 className="font-semibold text-slate-800 mb-4 text-sm">
              Lead time médio por mês (dias)
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="Lead time médio (dias)"
                  stroke={BRAND}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h2 className="font-semibold text-slate-800 mb-4 text-sm">
              Entregas no prazo por mês (%)
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                  domain={[0, 100]}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="Entregas no prazo (%)"
                  stroke={ACCENT}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 lg:col-span-2">
            <h2 className="font-semibold text-slate-800 mb-4 text-sm">
              Encomendas entregues por mês
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Encomendas entregues" fill={BRAND} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center text-sm text-slate-400">
          Ainda sem encomendas entregues para mostrar a evolução ao longo do
          tempo.
        </div>
      )}
    </>
  );
}
