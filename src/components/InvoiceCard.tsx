"use client";

import { useState, useTransition } from "react";
import { FileText, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import type { InvoiceVM, CompanyFiscalVM } from "@/lib/types";
import { INVOICE_PROVIDER_LABELS } from "@/lib/types";
import { actionError } from "@/lib/action-result";
import { issueInvoice } from "@/actions/invoices";
import { updateCompanyFiscalInfo } from "@/actions/companies";
import { formatEur } from "@/lib/format";

interface Props {
  orderId: string;
  companyId: string;
  companyFiscal: CompanyFiscalVM;
  invoice: InvoiceVM | null;
}

/** Admin-only card for issuing/viewing the real fiscal invoice for a delivered order.
 * If the client company has no NIF on file yet, shows a small inline form to fill
 * it in first — a real invoice can't be issued without it. */
export function InvoiceCard({ orderId, companyId, companyFiscal, invoice }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fiscal, setFiscal] = useState(companyFiscal);
  const [fiscalPending, startFiscalTransition] = useTransition();
  const [fiscalError, setFiscalError] = useState("");
  const [form, setForm] = useState({
    taxId: companyFiscal.taxId ?? "",
    billingAddress: companyFiscal.billingAddress ?? "",
    billingPostalCode: companyFiscal.billingPostalCode ?? "",
    billingCity: companyFiscal.billingCity ?? "",
    billingCountry: companyFiscal.billingCountry ?? "Portugal",
  });

  const handleIssue = () => {
    setError("");
    startTransition(async () => {
      const res = await issueInvoice(orderId);
      const msg = actionError(res);
      if (msg) setError(msg);
    });
  };

  const handleSaveFiscal = () => {
    setFiscalError("");
    startFiscalTransition(async () => {
      const res = await updateCompanyFiscalInfo(companyId, orderId, form);
      const msg = actionError(res);
      if (msg) {
        setFiscalError(msg);
        return;
      }
      setFiscal(res as CompanyFiscalVM);
    });
  };

  const isRetry = invoice?.status === "failed";
  const missingTaxId = !fiscal.taxId;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <FileText size={16} className="text-slate-400" /> Faturação
      </h2>

      {invoice?.status !== "issued" && missingTaxId && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-medium text-amber-800">
            Dados fiscais em falta — necessários para emitir a fatura.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="NIF (9 dígitos)"
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              className="col-span-2 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Morada"
              value={form.billingAddress}
              onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
              className="col-span-2 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Código postal"
              value={form.billingPostalCode}
              onChange={(e) => setForm({ ...form, billingPostalCode: e.target.value })}
              className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Cidade"
              value={form.billingCity}
              onChange={(e) => setForm({ ...form, billingCity: e.target.value })}
              className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveFiscal}
            disabled={fiscalPending}
            className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            Guardar dados fiscais
          </button>
          {fiscalError && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {fiscalError}
            </p>
          )}
        </div>
      )}

      {invoice?.status === "issued" ? (
        <div>
          <p className="text-sm text-slate-600">
            Fatura {invoice.number ?? invoice.id} emitida via{" "}
            {INVOICE_PROVIDER_LABELS[invoice.provider]}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Total: {formatEur(invoice.totalEur)}
          </p>
          {invoice.pdfUrl && (
            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              <ExternalLink size={14} /> Ver documento
            </a>
          )}
        </div>
      ) : (
        <div>
          {invoice?.status === "failed" && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{invoice.errorMessage ?? "Falha ao emitir a fatura."}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleIssue}
            disabled={pending || missingTaxId}
            title={missingTaxId ? "Preencha o NIF do cliente primeiro" : undefined}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {isRetry ? <RefreshCw size={14} /> : <FileText size={14} />}
            {isRetry ? "Tentar novamente" : "Emitir Fatura"}
          </button>
          {error && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
