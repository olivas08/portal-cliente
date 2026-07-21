"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, X, Trash2 } from "lucide-react";
import type { OrderVM } from "@/lib/types";
import { reorderOrder } from "@/actions/orders";

interface ReorderLine {
  sourceItemId: string;
  reference: string;
  description: string;
  unit: string;
  unitPriceEur: number;
  quantity: string;
}

export function ReorderModal({ order }: { order: OrderVM }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [expectedDate, setExpectedDate] = useState("");
  const [observations, setObservations] = useState("");
  const [lines, setLines] = useState<ReorderLine[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const inputCls =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

  const open = () => {
    setLines(
      order.items.map((it) => ({
        sourceItemId: it.id,
        reference: it.reference,
        description: it.description,
        unit: it.unit,
        unitPriceEur: it.unitPriceEur,
        quantity: String(it.quantity),
      })),
    );
    setExpectedDate("");
    setObservations("");
    setError("");
    setShowModal(true);
  };

  const updateQuantity = (index: number, quantity: string) =>
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, quantity } : l)),
    );

  const removeLine = (index: number) =>
    setLines((prev) => prev.filter((_, i) => i !== index));

  const total = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * l.unitPriceEur,
    0,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const id = await reorderOrder({
          sourceOrderId: order.id,
          expectedDate,
          observations: observations || undefined,
          items: lines.map((l) => ({
            sourceItemId: l.sourceItemId,
            quantity: Number(l.quantity),
          })),
        });
        setShowModal(false);
        router.push(`/dashboard/ordens/${id}`);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Ocorreu um erro. Tente novamente.",
        );
      }
    });
  };

  return (
    <>
      <button
        onClick={open}
        className="flex items-center gap-2 px-4 py-2 bg-accent text-brand text-sm font-semibold rounded-lg hover:bg-accent-dark transition-colors"
      >
        <RotateCcw size={15} /> Encomendar de novo
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Encomendar de novo"
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h2 className="font-semibold text-slate-800">
                  Encomendar de novo
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  A partir de {order.reference}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Data de entrega desejada *
                </label>
                <input
                  type="date"
                  required
                  className={inputCls}
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Artigos a repetir
                </label>
                <div className="space-y-2">
                  {lines.map((line, i) => (
                    <div
                      key={line.sourceItemId}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg p-2.5 border border-slate-100"
                    >
                      <div className="col-span-7 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {line.description}
                        </p>
                        <p className="text-xs font-mono text-slate-400">
                          {line.reference} · {line.unitPriceEur.toFixed(2)} €/
                          {line.unit}
                        </p>
                      </div>
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        className={`col-span-3 ${inputCls} bg-white`}
                        value={line.quantity}
                        onChange={(e) => updateQuantity(i, e.target.value)}
                        placeholder="Qtd"
                        aria-label={`Quantidade de ${line.description}`}
                      />
                      <span className="col-span-1 text-xs text-slate-400 text-center">
                        {line.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        disabled={lines.length === 1}
                        className="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-600 disabled:opacity-30 py-1"
                        aria-label={`Remover ${line.description}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-500 text-right mt-2">
                  Total estimado (s/ IVA):{" "}
                  <strong className="text-brand">{total.toFixed(2)} €</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Observações
                </label>
                <textarea
                  rows={3}
                  className={inputCls + " resize-none"}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Alguma indicação para esta encomenda..."
                />
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                A encomenda será criada em estado{" "}
                <strong>Pendente</strong> e confirmada pela fábrica.
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending || lines.length === 0}
                  className="px-4 py-2 text-sm font-semibold text-brand bg-accent rounded-lg hover:bg-accent-dark disabled:opacity-60"
                >
                  {pending ? "A criar..." : "Criar Encomenda"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
