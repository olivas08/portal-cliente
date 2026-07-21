"use client";

import { useState } from "react";
import Link from "next/link";
import type { RequestSummaryVM, RequestStatus } from "@/lib/types";
import { matchesSearch } from "@/lib/search";
import { SearchInput } from "@/components/SearchInput";
import {
  RequestStatusBadge,
  RequestTypeBadge,
} from "@/components/RequestBadges";

const STATUS_FILTERS: { id: RequestStatus | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "open", label: "Abertos" },
  { id: "in_review", label: "Em Análise" },
  { id: "responded", label: "Respondidos" },
  { id: "closed", label: "Fechados" },
];

export function AdminRequestsView({
  requests,
  companies,
}: {
  requests: RequestSummaryVM[];
  companies: { id: string; name: string }[];
}) {
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">(
    "all"
  );
  const [clientFilter, setClientFilter] = useState("all");
  const [search, setSearch] = useState("");

  const openCount = requests.filter((r) => r.status === "open").length;
  const filtered = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (clientFilter !== "all" && r.companyId !== clientFilter) return false;
    if (!matchesSearch(search, r.reference, r.subject, r.clientCompany))
      return false;
    return true;
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Requerimentos</h1>
          <p className="text-slate-500 text-sm mt-1">
            {requests.length} total
            {openCount > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                · {openCount} aberto{openCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
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
          {filtered.map((r) => {
            const lastMsg = r.lastMessage;
            const needsReply = lastMsg?.from === "client";
            return (
              <Link
                key={r.id}
                href={`/admin/requerimentos/${r.id}`}
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-400 flex-shrink-0">
                      {r.reference}
                    </span>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {r.subject}
                    </p>
                    {needsReply && r.status !== "closed" && (
                      <span className="text-xs bg-orange-100 text-orange-700 font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                        Aguarda resposta
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {r.clientCompany} · {r.createdDate} · {r.messageCount}{" "}
                    mensagem{r.messageCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <RequestTypeBadge type={r.type} />
                  <RequestStatusBadge status={r.status} />
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-10">
              Sem requerimentos para os filtros selecionados.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
