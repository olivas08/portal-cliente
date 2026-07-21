"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { OrderSummaryVM } from "@/lib/types";
import { matchesSearch } from "@/lib/search";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { SearchInput } from "@/components/SearchInput";

/** Client-side searchable/filterable list of the company's own orders. */
export function ClientOrdersList({ orders }: { orders: OrderSummaryVM[] }) {
  const [search, setSearch] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);

  const filtered = orders.filter((o) => {
    if (urgentOnly && o.priority !== "urgent") return false;
    if (
      !matchesSearch(
        search,
        o.reference,
        ...o.items.flatMap((i) => [i.reference, i.description])
      )
    )
      return false;
    return true;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold text-slate-800">As Minhas Encomendas</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Pesquisar por referência ou artigo…"
            className="w-full sm:w-64"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={urgentOnly}
              onChange={(e) => setUrgentOnly(e.target.checked)}
              className="accent-amber-500"
            />
            Só urgentes
          </label>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {filtered.map((order) => {
          const isUrgent = order.priority === "urgent";
          return (
            <Link
              key={order.id}
              href={`/dashboard/ordens/${order.id}`}
              className={`flex items-center gap-4 px-5 py-4 border-l-4 hover:bg-slate-50 transition-colors ${
                isUrgent
                  ? "border-l-amber-500 bg-amber-50/40"
                  : "border-l-transparent"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">
                    {order.reference}
                  </p>
                  {isUrgent && (
                    <span className="text-[10px] bg-amber-500 text-white font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
                      Urgente
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {order.items.length} artigo
                  {order.items.length !== 1 ? "s" : ""} · Prazo:{" "}
                  {order.expectedDate}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
              <ChevronRight
                size={16}
                className="text-slate-300 flex-shrink-0 hidden sm:block"
              />
            </Link>
          );
        })}

        {orders.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-10">
            Sem encomendas registadas.
          </p>
        )}
        {orders.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-10">
            Sem encomendas para os filtros selecionados.
          </p>
        )}
      </div>
    </div>
  );
}
