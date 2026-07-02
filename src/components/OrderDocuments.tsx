"use client";

import { FileText, Award, Receipt } from "lucide-react";
import type { OrderVM } from "@/lib/types";
import {
  generateDeliveryNote,
  generateQualityCert,
  generateProformaInvoice,
} from "@/lib/generatePdf";

export function OrderDocumentsCards({ order }: { order: OrderVM }) {
  const canCert = ["quality", "shipped", "delivered"].includes(order.status);
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-slate-800 mb-1">Documentos</h2>
      <p className="text-xs text-slate-400 mb-5">
        Clique para gerar e descarregar o documento em PDF.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => generateDeliveryNote(order)}
          className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-all text-left group"
        >
          <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
            <FileText size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Guia de Remessa</p>
            <p className="text-xs text-slate-400 mt-0.5">PDF · Expedição</p>
          </div>
        </button>

        <button
          onClick={() => generateQualityCert(order)}
          disabled={!canCert}
          className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-all text-left group disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
            <Award size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Certificado de Conformidade
            </p>
            <p className="text-xs text-slate-400 mt-0.5">PDF · Qualidade</p>
          </div>
        </button>

        <button
          onClick={() => generateProformaInvoice(order)}
          className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-all text-left group"
        >
          <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
            <Receipt size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Fatura Pro-forma
            </p>
            <p className="text-xs text-slate-400 mt-0.5">PDF · Financeiro</p>
          </div>
        </button>
      </div>

      {!canCert && (
        <p className="text-xs text-slate-400 mt-3">
          * O certificado de conformidade fica disponível após o controlo de
          qualidade.
        </p>
      )}
    </div>
  );
}

export function OrderDocumentsButtons({ order }: { order: OrderVM }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-slate-800 mb-4">Gerar Documentos</h2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => generateDeliveryNote(order)}
          className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          📄 Guia de Remessa
        </button>
        <button
          onClick={() => generateQualityCert(order)}
          className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          ✅ Certificado de Conformidade
        </button>
        <button
          onClick={() => generateProformaInvoice(order)}
          className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          🧾 Fatura Pro-forma
        </button>
      </div>
    </div>
  );
}
