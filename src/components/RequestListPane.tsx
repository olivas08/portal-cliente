import Link from "next/link";
import type { RequestVM } from "@/lib/types";
import { RequestStatusBadge, RequestTypeBadge } from "@/components/RequestBadges";

export function RequestListPane({
  requests,
  basePath,
  activeId,
  showCompany = false,
}: {
  requests: RequestVM[];
  basePath: string;
  activeId: string;
  showCompany?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Requerimentos</h2>
      </div>
      <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
        {requests.map((r) => {
          const active = r.id === activeId;
          const lastMsg = r.messages[r.messages.length - 1];
          return (
            <Link
              key={r.id}
              href={`${basePath}/${r.id}`}
              className={`block px-4 py-3 border-l-4 transition-colors ${
                active
                  ? "border-l-accent bg-amber-50/50"
                  : "border-l-transparent hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-slate-400 leading-none mb-1">
                    {r.reference}
                  </p>
                  <p
                    className={`text-sm font-semibold truncate ${
                      active ? "text-brand" : "text-slate-700"
                    }`}
                  >
                    {r.subject}
                  </p>
                </div>
                <RequestStatusBadge status={r.status} />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <RequestTypeBadge type={r.type} />
              </div>
              <p className="text-xs text-slate-400 truncate">
                {showCompany ? `${r.clientCompany} · ` : ""}
                {lastMsg?.from === "admin" ? "Resposta da fábrica" : "Aguarda resposta"}
              </p>
            </Link>
          );
        })}
        {requests.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">
            Sem requerimentos.
          </p>
        )}
      </div>
    </div>
  );
}
