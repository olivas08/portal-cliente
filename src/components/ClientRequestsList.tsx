"use client";

import { useState } from "react";
import Link from "next/link";
import type { RequestVM } from "@/lib/types";
import { matchesSearch } from "@/lib/search";
import { SearchInput } from "@/components/SearchInput";
import {
  RequestStatusBadge,
  RequestTypeBadge,
} from "@/components/RequestBadges";

/** Client-side searchable list of the company's own requests. */
export function ClientRequestsList({ requests }: { requests: RequestVM[] }) {
  const [search, setSearch] = useState("");

  const filtered = requests.filter((r) =>
    matchesSearch(search, r.reference, r.subject)
  );

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {requests.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Pesquisar por referência ou assunto…"
            className="w-full sm:w-72"
          />
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {filtered.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/requerimentos/${r.id}`}
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
                {r.messages[r.messages.length - 1]?.from === "admin" && (
                  <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                    Nova resposta
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {r.createdDate} · {r.messages.length} mensagem
                {r.messages.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <RequestTypeBadge type={r.type} />
              <RequestStatusBadge status={r.status} />
            </div>
          </Link>
        ))}
        {requests.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-10">
            Sem requerimentos. Clique em &quot;Novo Requerimento&quot; para
            começar.
          </p>
        )}
        {requests.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-10">
            Sem requerimentos para a pesquisa atual.
          </p>
        )}
      </div>
    </div>
  );
}
