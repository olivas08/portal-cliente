"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { PricingSettingsVM, QuoteOperation, QuoteVM } from "@/lib/types";
import { QUOTE_OPERATION_LABELS } from "@/lib/types";
import { createQuote, updateQuote } from "@/actions/quotes";
import { actionError } from "@/lib/action-result";

interface LineForm {
  description: string;
  operation: QuoteOperation;
  quantity: string;
  unit: string;
  materialWeightKg: string;
  laserMinutes: string;
  bendCount: string;
  weldingMinutes: string;
  finishingM2: string;
}

const EMPTY_LINE: LineForm = {
  description: "",
  operation: "corte_laser",
  quantity: "1",
  unit: "un",
  materialWeightKg: "0",
  laserMinutes: "0",
  bendCount: "0",
  weldingMinutes: "0",
  finishingM2: "0",
};

function num(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function lineCost(pricing: PricingSettingsVM, l: LineForm): number {
  return (
    num(l.materialWeightKg) * pricing.steelPriceEurKg +
    num(l.laserMinutes) * pricing.laserEurPerMinute +
    num(l.bendCount) * pricing.bendEurPerBend +
    num(l.weldingMinutes) * pricing.weldingEurPerMinute +
    num(l.finishingM2) * pricing.finishingEurPerM2
  );
}

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";
const smallInputCls =
  "w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

export function QuoteBuilder({
  companies,
  pricing,
  quote,
}: {
  companies: { id: string; name: string }[];
  pricing: PricingSettingsVM;
  quote?: QuoteVM;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState(quote?.companyId ?? companies[0]?.id ?? "");
  const [subject, setSubject] = useState(quote?.subject ?? "");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [marginPercent, setMarginPercent] = useState(
    String(quote?.marginPercent ?? pricing.defaultMarginPercent),
  );
  const [validUntil, setValidUntil] = useState(quote?.validUntil ?? "");
  const [lines, setLines] = useState<LineForm[]>(
    quote
      ? quote.lines.map((l) => ({
          description: l.description,
          operation: l.operation,
          quantity: String(l.quantity),
          unit: l.unit,
          materialWeightKg: String(l.materialWeightKg),
          laserMinutes: String(l.laserMinutes),
          bendCount: String(l.bendCount),
          weldingMinutes: String(l.weldingMinutes),
          finishingM2: String(l.finishingM2),
        }))
      : [{ ...EMPTY_LINE }],
  );

  const margin = num(marginPercent);
  const priced = useMemo(
    () =>
      lines.map((l) => {
        const unitCost = lineCost(pricing, l);
        const total = unitCost * num(l.quantity) * (1 + margin / 100);
        return { unitCost, total };
      }),
    [lines, pricing, margin],
  );
  const grandTotal = priced.reduce((s, p) => s + p.total, 0);

  function updateLine(i: number, patch: Partial<LineForm>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, { ...EMPTY_LINE }]);
  }

  function removeLine(i: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      companyId,
      subject: subject.trim(),
      notes: notes.trim() || undefined,
      marginPercent: margin,
      validUntil: validUntil || undefined,
      lines: lines.map((l) => ({
        description: l.description.trim(),
        operation: l.operation,
        quantity: num(l.quantity),
        unit: l.unit.trim() || "un",
        materialWeightKg: num(l.materialWeightKg),
        laserMinutes: num(l.laserMinutes),
        bendCount: num(l.bendCount),
        weldingMinutes: num(l.weldingMinutes),
        finishingM2: num(l.finishingM2),
      })),
    };

    startTransition(async () => {
      const res = quote
        ? await updateQuote(quote.id, payload)
        : await createQuote(payload);
      const msg = actionError(res);
      if (msg) {
        setError(msg);
        return;
      }
      const targetId = quote ? quote.id : (res as string);
      router.push(`/admin/orcamentos/${targetId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Link
        href="/admin/orcamentos"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors w-fit"
      >
        <ArrowLeft size={16} /> Voltar aos orçamentos
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Cliente *
            </label>
            <select
              required
              className={inputCls}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Assunto *
            </label>
            <input
              required
              className={inputCls}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Estrutura em inox 304 para linha de enchimento"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Margem (%) *
            </label>
            <input
              required
              type="number"
              min={0}
              step="0.5"
              className={inputCls}
              value={marginPercent}
              onChange={(e) => setMarginPercent(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Válido até
            </label>
            <input
              type="date"
              className={inputCls}
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Observações
          </label>
          <textarea
            rows={2}
            className={inputCls + " resize-none"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condições, prazo de entrega, notas internas..."
          />
        </div>
      </div>

      <div className="space-y-3">
        {lines.map((line, i) => (
          <div
            key={i}
            className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400">
                Linha {i + 1}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-700">
                  {priced[i].total.toFixed(2)} €
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={lines.length === 1}
                  className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Descrição *
                </label>
                <input
                  required
                  className={smallInputCls}
                  value={line.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                  placeholder="Ex: Painel lateral inox 304, 1.5mm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Operação
                </label>
                <select
                  className={smallInputCls}
                  value={line.operation}
                  onChange={(e) =>
                    updateLine(i, { operation: e.target.value as QuoteOperation })
                  }
                >
                  {(Object.keys(QUOTE_OPERATION_LABELS) as QuoteOperation[]).map(
                    (op) => (
                      <option key={op} value={op}>
                        {QUOTE_OPERATION_LABELS[op]}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Qtd. *
                  </label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    className={smallInputCls}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Un.
                  </label>
                  <input
                    className={smallInputCls}
                    value={line.unit}
                    onChange={(e) => updateLine(i, { unit: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Chapa (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={smallInputCls}
                  value={line.materialWeightKg}
                  onChange={(e) => updateLine(i, { materialWeightKg: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Laser (min)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={smallInputCls}
                  value={line.laserMinutes}
                  onChange={(e) => updateLine(i, { laserMinutes: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Quinagem (dobras)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={smallInputCls}
                  value={line.bendCount}
                  onChange={(e) => updateLine(i, { bendCount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Soldadura (min)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={smallInputCls}
                  value={line.weldingMinutes}
                  onChange={(e) => updateLine(i, { weldingMinutes: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Acabamento (m²)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={smallInputCls}
                  value={line.finishingM2}
                  onChange={(e) => updateLine(i, { finishingM2: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addLine}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-dashed border-slate-300 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-colors w-full justify-center"
        >
          <Plus size={16} /> Adicionar linha
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
        <div>
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-400">Total (com margem de {margin}%)</p>
            <p className="text-xl font-bold text-slate-800">
              {grandTotal.toFixed(2)} €
            </p>
          </div>
          <button
            type="submit"
            disabled={pending || !companyId}
            className="px-5 py-2.5 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-soft disabled:opacity-60 transition-colors"
          >
            {quote ? "Guardar alterações" : "Criar rascunho"}
          </button>
        </div>
      </div>
    </form>
  );
}
