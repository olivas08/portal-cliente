"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { OrderVM, OrderStatus } from "@/lib/types";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { NewOrderModal } from "@/components/NewOrderModal";

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "production",
  "quality",
  "shipped",
  "delivered",
];
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendente",
  production: "Em Produção",
  quality: "Controlo Q.",
  shipped: "Expedido",
  delivered: "Entregue",
};

export function AdminOrdersView({
  orders,
  companies,
}: {
  orders: OrderVM[];
  companies: { id: string; name: string }[];
}) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (clientFilter !== "all" && o.companyId !== clientFilter) return false;
    return true;
  });

  const countByStatus = (s: OrderStatus) =>
    orders.filter((o) => o.status === s).length;

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-xl">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Painel Administrativo
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Gestão de todas as encomendas
            </p>
          </div>
        </div>
        <NewOrderModal companies={companies} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`bg-white rounded-xl p-4 shadow-sm border text-left transition-all hover:shadow-md ${
              statusFilter === s
                ? "border-slate-700 ring-2 ring-slate-300"
                : "border-slate-100"
            }`}
          >
            <p className="text-xs text-slate-400 font-medium truncate">
              {STATUS_LABELS[s]}
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {countByStatus(s)}
            </p>
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
        >
          <option value="all">Todos os clientes</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {statusFilter !== "all" && (
          <button
            onClick={() => setStatusFilter("all")}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            ✕ Limpar filtro
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 self-center">
          {filtered.length} encomenda{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 font-medium border-b border-slate-100">
                <th className="text-left px-5 py-3">Referência</th>
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-5 py-3">Estado</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">
                  Prazo
                </th>
                <th className="text-left px-5 py-3 hidden md:table-cell">
                  Artigos
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-slate-700">
                        {order.reference}
                      </span>
                      {order.priority === "urgent" && (
                        <span className="text-xs bg-orange-100 text-orange-700 font-medium px-1.5 py-0.5 rounded-full">
                          Urgente
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs">
                    {order.clientCompany}
                  </td>
                  <td className="px-5 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 hidden sm:table-cell">
                    {order.expectedDate}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400 hidden md:table-cell">
                    {order.items.length} artigo
                    {order.items.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/ordens/${order.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Gerir →
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-slate-400"
                  >
                    Sem encomendas para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
