"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2 } from "lucide-react";
import { createOrder } from "@/actions/orders";

interface ItemForm {
  reference: string;
  description: string;
  quantity: string;
  unit: string;
  unitPriceEur: string;
}

const emptyItem: ItemForm = {
  reference: "",
  description: "",
  quantity: "1",
  unit: "un",
  unitPriceEur: "",
};

export function NewOrderModal({
  companies,
}: {
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [batchNumber, setBatchNumber] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [observations, setObservations] = useState("");
  const [items, setItems] = useState<ItemForm[]>([{ ...emptyItem }]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const inputCls =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

  const updateItem = (index: number, patch: Partial<ItemForm>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it))
    );
  };

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);
  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const reset = () => {
    setCompanyId(companies[0]?.id ?? "");
    setBatchNumber("");
    setExpectedDate("");
    setObservations("");
    setItems([{ ...emptyItem }]);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const id = await createOrder({
          companyId,
          batchNumber,
          expectedDate,
          observations: observations || undefined,
          items: items.map((it) => ({
            reference: it.reference,
            description: it.description,
            quantity: Number(it.quantity),
            unit: it.unit,
            unitPriceEur: Number(it.unitPriceEur),
          })),
        });
        setShowModal(false);
        reset();
        router.push(`/admin/ordens/${id}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ocorreu um erro. Tente novamente."
        );
      }
    });
  };

  const total = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPriceEur) || 0),
    0
  );

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-soft transition-colors"
      >
        <Plus size={16} /> Nova Encomenda
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-slate-800">Nova Encomenda</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
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
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nº de Lote *
                  </label>
                  <input
                    required
                    className={inputCls}
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="Ex: LT-2026-090"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Data Prevista *
                  </label>
                  <input
                    type="date"
                    required
                    className={inputCls}
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Artigos *
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 text-xs font-medium text-brand hover:text-accent-dark"
                  >
                    <Plus size={13} /> Adicionar artigo
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 items-start bg-slate-50 rounded-lg p-2.5 border border-slate-100"
                    >
                      <input
                        required
                        className={`col-span-3 ${inputCls} bg-white`}
                        value={item.reference}
                        onChange={(e) =>
                          updateItem(i, { reference: e.target.value })
                        }
                        placeholder="Referência"
                      />
                      <input
                        required
                        className={`col-span-4 ${inputCls} bg-white`}
                        value={item.description}
                        onChange={(e) =>
                          updateItem(i, { description: e.target.value })
                        }
                        placeholder="Descrição"
                      />
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        className={`col-span-1 ${inputCls} bg-white`}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(i, { quantity: e.target.value })
                        }
                        placeholder="Qtd"
                      />
                      <input
                        required
                        className={`col-span-1 ${inputCls} bg-white`}
                        value={item.unit}
                        onChange={(e) => updateItem(i, { unit: e.target.value })}
                        placeholder="Un."
                      />
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        className={`col-span-2 ${inputCls} bg-white`}
                        value={item.unitPriceEur}
                        onChange={(e) =>
                          updateItem(i, { unitPriceEur: e.target.value })
                        }
                        placeholder="Preço €"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                        className="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-600 disabled:opacity-30 py-2"
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
                  placeholder="Notas internas sobre esta encomenda..."
                />
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
                  disabled={pending || !companyId}
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
