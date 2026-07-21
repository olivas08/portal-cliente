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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OrderKpis } from "@/lib/kpis";

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

export function AdminKpisView({ kpis }: { kpis: OrderKpis }) {
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
