"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ShieldCheck } from "lucide-react";
import type { OrderSummaryVM, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_SHORT_LABELS } from "@/lib/types";
import { matchesSearch } from "@/lib/search";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { NewOrderModal } from "@/components/NewOrderModal";
import { SearchInput } from "@/components/SearchInput";

type SortKey = "reference" | "clientCompany" | "status" | "expectedDate" | "items";
type SortDir = "asc" | "desc";

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = activeKey === sortKey;
  const Icon = isActive ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`text-left px-5 py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 font-medium hover:text-slate-700 transition-colors ${
          isActive ? "text-slate-700" : ""
        }`}
      >
        {label}
        <Icon size={12} className={isActive ? "text-slate-700" : "text-slate-300"} />
      </button>
    </th>
  );
}

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "production",
  "quality",
  "shipped",
  "delivered",
];

export function AdminOrdersView({
  orders,
  companies,
}: {
  orders: OrderSummaryVM[];
  companies: { id: string; name: string }[];
}) {
  const [statusFilters, setStatusFilters] = useState<Set<OrderStatus>>(
    () => new Set()
  );
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [expectedFrom, setExpectedFrom] = useState("");
  const [expectedTo, setExpectedTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleStatus = (s: OrderStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = orders.filter((o) => {
    if (statusFilters.size > 0 && !statusFilters.has(o.status)) return false;
    if (clientFilter !== "all" && o.companyId !== clientFilter) return false;
    if (urgentOnly && o.priority !== "urgent") return false;
    if (expectedFrom && o.expectedDate < expectedFrom) return false;
    if (expectedTo && o.expectedDate > expectedTo) return false;
    if (
      !matchesSearch(
        search,
        o.reference,
        o.clientCompany,
        ...o.items.flatMap((i) => [i.reference, i.description])
      )
    )
      return false;
    return true;
  });

  const clearFilters = () => {
    setStatusFilters(new Set());
    setClientFilter("all");
    setSearch("");
    setUrgentOnly(false);
    setExpectedFrom("");
    setExpectedTo("");
  };

  const hasActiveFilters =
    statusFilters.size > 0 ||
    clientFilter !== "all" ||
    search !== "" ||
    urgentOnly ||
    expectedFrom !== "" ||
    expectedTo !== "";

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "reference":
          return a.reference.localeCompare(b.reference) * dir;
        case "clientCompany":
          return a.clientCompany.localeCompare(b.clientCompany) * dir;
        case "status":
          return (ALL_STATUSES.indexOf(a.status) - ALL_STATUSES.indexOf(b.status)) * dir;
        case "expectedDate":
          return a.expectedDate.localeCompare(b.expectedDate) * dir;
        case "items":
          return (a.items.length - b.items.length) * dir;
        default:
          return 0;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir]);

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
            onClick={() => toggleStatus(s)}
            className={`bg-white rounded-xl p-4 shadow-sm border text-left transition-all hover:shadow-md ${
              statusFilters.has(s)
                ? "border-slate-700 ring-2 ring-slate-300"
                : "border-slate-100"
            }`}
          >
            <p className="text-xs text-slate-400 font-medium truncate">
              {ORDER_STATUS_SHORT_LABELS[s]}
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {countByStatus(s)}
            </p>
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap items-center mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Pesquisar por referência, cliente ou artigo…"
          className="w-full sm:w-72"
        />
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
        <label className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer select-none">
          <input
            type="checkbox"
            checked={urgentOnly}
            onChange={(e) => setUrgentOnly(e.target.checked)}
            className="accent-amber-500"
          />
          Só urgentes
        </label>
        <div className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-white">
          <span className="text-xs text-slate-400">Prazo</span>
          <input
            type="date"
            value={expectedFrom}
            onChange={(e) => setExpectedFrom(e.target.value)}
            className="text-xs text-slate-600 focus:outline-none w-[110px]"
          />
          <span className="text-xs text-slate-300">–</span>
          <input
            type="date"
            value={expectedTo}
            onChange={(e) => setExpectedTo(e.target.value)}
            className="text-xs text-slate-600 focus:outline-none w-[110px]"
          />
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            ✕ Limpar filtros
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
                <SortableTh
                  label="Referência"
                  sortKey="reference"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Cliente"
                  sortKey="clientCompany"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Estado"
                  sortKey="status"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Prazo"
                  sortKey="expectedDate"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  className="hidden sm:table-cell"
                />
                <SortableTh
                  label="Artigos"
                  sortKey="items"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  className="hidden md:table-cell"
                />
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((order) => (
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
