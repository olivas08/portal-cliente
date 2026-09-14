"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Send, Pencil, Check, X as XIcon } from "lucide-react";
import type { QuoteVM } from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import { QuoteStatusBadge } from "@/components/QuoteBadges";
import { sendQuote, decideQuote } from "@/actions/quotes";
import { actionError } from "@/lib/action-result";
import { formatEur } from "@/lib/format";

async function downloadQuotePdf(quote: QuoteVM) {
  const mod = await import("@/lib/generatePdf");
  mod.generateQuoteProposal(quote);
}

export function QuoteDetail({ quote, isAdmin }: { quote: QuoteVM; isAdmin: boolean }) {
  const basePath = isAdmin ? "/admin/orcamentos" : "/dashboard/orcamentos";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const res = await sendQuote(quote.id);
      const msg = actionError(res);
      if (msg) setError(msg);
    });
  }

  function handleDecide(decision: "accepted" | "rejected") {
    setError(null);
    startTransition(async () => {
      const res = await decideQuote(quote.id, decision);
      const msg = actionError(res);
      if (msg) setError(msg);
    });
  }

  return (
    <>
      <BreadcrumbSetter text={quote.subject} />
      <Link
        href={basePath}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5 w-fit"
      >
        <ArrowLeft size={16} /> Voltar aos orçamentos
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <div>
            <p className="text-xs font-mono text-slate-400 mb-0.5">{quote.reference}</p>
            <h1 className="text-lg font-bold text-slate-800">{quote.subject}</h1>
            <p className="text-xs text-slate-400 mt-1">
              {isAdmin ? `${quote.clientCompany} · ` : ""}Criado em {quote.createdDate}
              {quote.validUntil ? ` · Válido até ${quote.validUntil}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <QuoteStatusBadge status={quote.status} />
            {isAdmin && quote.status === "draft" && (
              <Link
                href={`/admin/orcamentos/${quote.id}/editar`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Pencil size={13} /> Editar
              </Link>
            )}
            <button
              onClick={() => downloadQuotePdf(quote)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Download size={13} /> PDF
            </button>
          </div>
        </div>

        {quote.notes && (
          <p className="text-sm text-slate-500 border-t border-slate-100 pt-3">
            {quote.notes}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-5">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Descrição</th>
              <th className="text-left px-4 py-2.5">Operações</th>
              <th className="text-center px-4 py-2.5">Qtd.</th>
              <th className="text-right px-4 py-2.5">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quote.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 text-slate-700">
                  {l.description}
                  {l.materialWeightKg > 0 && (
                    <span className="block text-xs text-slate-400">
                      Material: {l.materialWeightKg} kg
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {l.operations.length === 0
                    ? "—"
                    : l.operations
                        .map((o) => `${o.name} (${o.quantity} ${o.unit})`)
                        .join(", ")}
                </td>
                <td className="px-4 py-2.5 text-center text-slate-500">
                  {l.quantity} {l.unit}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                  {formatEur(l.lineTotalEur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-end gap-3 px-4 py-3 bg-slate-50 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            Margem incluída: {quote.marginPercent}%
          </span>
          <span className="text-base font-bold text-slate-800">
            Total: {formatEur(quote.totalEur)}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium mb-3 text-center">{error}</p>
      )}

      {isAdmin && quote.status === "draft" && (
        <button
          onClick={handleSend}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-soft disabled:opacity-60 transition-colors"
        >
          <Send size={15} /> Enviar ao cliente
        </button>
      )}

      {!isAdmin && quote.status === "sent" && (
        <div className="flex gap-3">
          <button
            onClick={() => handleDecide("rejected")}
            disabled={pending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            <XIcon size={15} /> Recusar
          </button>
          <button
            onClick={() => handleDecide("accepted")}
            disabled={pending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            <Check size={15} /> Aceitar orçamento
          </button>
        </div>
      )}

      {quote.status === "accepted" && quote.orderId && (
        <Link
          href={isAdmin ? `/admin/ordens/${quote.orderId}` : `/dashboard/ordens/${quote.orderId}`}
          className="block text-center text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 hover:bg-emerald-100 transition-colors"
        >
          Orçamento aceite — ver encomenda gerada →
        </Link>
      )}
    </>
  );
}
