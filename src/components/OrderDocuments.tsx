"use client";

import { FileText, Award, Receipt, Download, Folder } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OrderVM } from "@/lib/types";
import {
  generateDeliveryNote,
  generateQualityCert,
  generateProformaInvoice,
} from "@/lib/generatePdf";

interface DocRow {
  icon: LucideIcon;
  title: string;
  meta: string;
  onClick: () => void;
  disabled?: boolean;
  pendingLabel?: string;
}

function DocList({ order, docs }: { order: OrderVM; docs: DocRow[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Folder size={16} className="text-slate-400" />
        Documentos
      </h3>
      <div className="flex flex-col gap-2.5">
        {docs.map(({ icon: Icon, title, meta, onClick, disabled, pendingLabel }) => (
          <button
            key={title}
            onClick={onClick}
            disabled={disabled}
            className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl hover:border-brand hover:bg-slate-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-transparent"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 flex-shrink-0">
                <Icon size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate group-enabled:group-hover:text-brand transition-colors">
                  {title}
                </p>
                <p className="text-xs text-slate-400">{meta}</p>
              </div>
            </div>
            {disabled && pendingLabel ? (
              <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded flex-shrink-0">
                {pendingLabel}
              </span>
            ) : (
              <Download
                size={16}
                className="text-slate-300 group-hover:text-brand transition-colors flex-shrink-0"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OrderDocumentsCards({ order }: { order: OrderVM }) {
  const canCert = ["quality", "shipped", "delivered"].includes(order.status);
  return (
    <DocList
      order={order}
      docs={[
        {
          icon: FileText,
          title: "Guia de Remessa",
          meta: "PDF · Expedição",
          onClick: () => generateDeliveryNote(order),
        },
        {
          icon: Award,
          title: "Certificado de Conformidade",
          meta: canCert ? "PDF · Qualidade" : "Aguarda controlo de qualidade",
          onClick: () => generateQualityCert(order),
          disabled: !canCert,
          pendingLabel: "Pendente",
        },
        {
          icon: Receipt,
          title: "Fatura Pro-forma",
          meta: "PDF · Financeiro",
          onClick: () => generateProformaInvoice(order),
        },
      ]}
    />
  );
}

// Admin uses the same rich card list.
export const OrderDocumentsButtons = OrderDocumentsCards;
