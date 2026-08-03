import Link from "next/link";
import type { QuoteSummaryVM } from "@/lib/types";
import { QuoteStatusBadge } from "@/components/QuoteBadges";

export function ClientQuotesList({ quotes }: { quotes: QuoteSummaryVM[] }) {
  const pendingCount = quotes.filter((q) => q.status === "sent").length;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Orçamentos</h1>
        <p className="text-slate-500 text-sm mt-1">
          {quotes.length} total
          {pendingCount > 0 && (
            <span className="ml-2 text-blue-600 font-medium">
              · {pendingCount} por decidir
            </span>
          )}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {quotes.map((q) => (
            <Link
              key={q.id}
              href={`/dashboard/orcamentos/${q.id}`}
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
                  {q.createdDate} · {q.lineCount} linha{q.lineCount !== 1 ? "s" : ""}
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
          {quotes.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-10">
              Ainda não recebeu nenhum orçamento.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
