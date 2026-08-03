"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import type { QuoteSummaryVM, QuoteStatus } from "@/lib/types";
import { matchesSearch } from "@/lib/search";
import { SearchInput } from "@/components/SearchInput";
import { QuoteStatusBadge } from "@/components/QuoteBadges";

const STATUS_FILTERS: { id: QuoteStatus | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "draft", label: "Rascunhos" },
  { id: "sent", label: "Enviados" },
  { id: "accepted", label: "Aceites" },
  { id: "rejected", label: "Recusados" },
];

export function AdminQuotesView({
  quotes,
  companies,
}: {
  quotes: QuoteSummaryVM[];
  companies: { id: string; name: string }[];
}) {
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [search, setSearch] = useState("");

  const draftCount = quotes.filter((q) => q.status === "draft").length;
  const filtered = quotes.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (clientFilter !== "all" && q.companyId !== clientFilter) return false;
    if (!matchesSearch(search, q.reference, q.subject, q.clientCompany)) return false;
    return true;
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orçamentos</h1>
          <p className="text-slate-500 text-sm mt-1">
            {quotes.length} total
            {draftCount > 0 && (
              <span className="ml-2 text-slate-600 font-medium">
                · {draftCount} rascunho{draftCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/orcamentos/definicoes"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Settings size={16} /> Definições
          </Link>
          <Link
            href="/admin/orcamentos/novo"
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-soft transition-colors"
          >
            <Plus size={16} /> Novo Orçamento
          </Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center mb-5">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {STATUS_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 bg-white focus:outline-none"
        >
          <option value="all">Todos os clientes</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Pesquisar por referência, assunto ou cliente…"
          className="w-full sm:w-72"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filtered.map((q) => (
            <Link
              key={q.id}
              href={`/admin/orcamentos/${q.id}`}
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-slate-400 flex-shrink-0">
                    {q.reference}
                  </span>
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {q.subject}
                  </p>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {q.clientCompany} · {q.createdDate} · {q.lineCount} linha
                  {q.lineCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-semibold text-slate-700">
                  {q.totalEur.toFixed(2)} €
                </span>
                <QuoteStatusBadge status={q.status} />
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-10">
              Sem orçamentos para os filtros selecionados.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
