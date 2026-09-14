"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { OperationTypeVM, PricingSettingsVM, QuoteVM } from "@/lib/types";
import { createQuote, updateQuote } from "@/actions/quotes";
import { actionError } from "@/lib/action-result";
import { inputCls } from "@/components/ui/Input";
import { formatEur } from "@/lib/format";

interface LineOperationForm {
  operationTypeId: string;
  quantity: string;
}

interface LineForm {
  description: string;
  quantity: string;
  unit: string;
  materialWeightKg: string;
  operations: LineOperationForm[];
}

const EMPTY_LINE: LineForm = {
  description: "",
  quantity: "1",
  unit: "un",
  materialWeightKg: "0",
  operations: [],
};

function num(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Live client-side cost preview for a line: material weight × steel price,
 * plus each selected operation's quantity × its current rate. Mirrors
 * `priceLines` in `quotes.service.ts` (the source of truth used on save) —
 * if an operation type can't be resolved (e.g. deleted mid-edit) it's
 * skipped here and the server will surface a clear error on submit instead
 * of silently mis-pricing. */
function lineCost(
  pricing: PricingSettingsVM,
  opMap: Map<string, OperationTypeVM>,
  l: LineForm,
): number {
  const opsCost = l.operations.reduce((s, o) => {
    const ot = opMap.get(o.operationTypeId);
    return ot ? s + num(o.quantity) * ot.ratePerUnitEur : s;
  }, 0);
  return num(l.materialWeightKg) * pricing.steelPriceEurKg + opsCost;
}

const smallInputCls =
  "w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

export function QuoteBuilder({
  companies,
  pricing,
  operationTypes,
  quote,
}: {
  companies: { id: string; name: string }[];
  pricing: PricingSettingsVM;
  operationTypes: OperationTypeVM[];
  quote?: QuoteVM;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const opMap = useMemo(
    () => new Map(operationTypes.map((o) => [o.id, o])),
    [operationTypes],
  );
  const defaultOperationTypeId = operationTypes.find((o) => o.active)?.id ?? "";

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
          quantity: String(l.quantity),
          unit: l.unit,
          materialWeightKg: String(l.materialWeightKg),
          operations: l.operations.map((o) => ({
            operationTypeId: o.operationTypeId ?? "",
            quantity: String(o.quantity),
          })),
        }))
      : [{ ...EMPTY_LINE }],
  );

  const margin = num(marginPercent);
  const priced = useMemo(
    () =>
      lines.map((l) => {
        const unitCost = lineCost(pricing, opMap, l);
        const total = unitCost * num(l.quantity) * (1 + margin / 100);
        return { unitCost, total };
      }),
    [lines, pricing, opMap, margin],
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

  function addOperation(lineIdx: number) {
    updateLine(lineIdx, {
      operations: [
        ...lines[lineIdx].operations,
        { operationTypeId: defaultOperationTypeId, quantity: "0" },
      ],
    });
  }

  function updateOperation(lineIdx: number, opIdx: number, patch: Partial<LineOperationForm>) {
    setLines((ls) =>
      ls.map((l, idx) =>
        idx === lineIdx
          ? {
              ...l,
              operations: l.operations.map((o, oi) => (oi === opIdx ? { ...o, ...patch } : o)),
            }
          : l,
      ),
    );
  }

  function removeOperation(lineIdx: number, opIdx: number) {
    setLines((ls) =>
      ls.map((l, idx) =>
        idx === lineIdx
          ? { ...l, operations: l.operations.filter((_, oi) => oi !== opIdx) }
          : l,
      ),
    );
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
        quantity: num(l.quantity),
        unit: l.unit.trim() || "un",
        materialWeightKg: num(l.materialWeightKg),
        operations: l.operations
          .filter((o) => o.operationTypeId)
          .map((o) => ({ operationTypeId: o.operationTypeId, quantity: num(o.quantity) })),
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
                  {formatEur(priced[i].total)}
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

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Chapa / material (kg)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={smallInputCls + " sm:w-40"}
                value={line.materialWeightKg}
                onChange={(e) => updateLine(i, { materialWeightKg: e.target.value })}
              />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">
                  Operações (processamento)
                </span>
                <button
                  type="button"
                  onClick={() => addOperation(i)}
                  disabled={!defaultOperationTypeId}
                  className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40"
                >
                  <Plus size={13} /> Adicionar operação
                </button>
              </div>

              {line.operations.length === 0 && (
                <p className="text-xs text-slate-400">
                  Nenhuma operação — apenas custo de material, se aplicável.
                </p>
              )}

              {line.operations.map((op, oi) => {
                const ot = opMap.get(op.operationTypeId);
                return (
                  <div key={oi} className="flex items-center gap-2">
                    <select
                      className={smallInputCls + " flex-1 min-w-0"}
                      value={op.operationTypeId}
                      onChange={(e) =>
                        updateOperation(i, oi, { operationTypeId: e.target.value })
                      }
                    >
                      {!ot && op.operationTypeId && (
                        <option value={op.operationTypeId}>Operação removida</option>
                      )}
                      {operationTypes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                          {o.active ? "" : " (inativo)"}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-20 shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                      value={op.quantity}
                      onChange={(e) => updateOperation(i, oi, { quantity: e.target.value })}
                    />
                    <span className="text-xs text-slate-400 w-10">{ot?.unit ?? ""}</span>
                    <button
                      type="button"
                      onClick={() => removeOperation(i, oi)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
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
              {formatEur(grandTotal)}
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
