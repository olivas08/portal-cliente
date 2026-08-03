"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Check, X as XIcon } from "lucide-react";
import type { OperationTypeVM } from "@/lib/types";
import {
  createOperationType,
  updateOperationType,
  deleteOperationType,
} from "@/actions/quotes";
import { actionError } from "@/lib/action-result";

interface RowForm {
  key: string;
  name: string;
  unit: string;
  ratePerUnitEur: string;
  active: boolean;
}

const EMPTY_ROW: RowForm = { key: "", name: "", unit: "", ratePerUnitEur: "0", active: true };

const inputCls =
  "w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

function toRowForm(t: OperationTypeVM): RowForm {
  return {
    key: t.key,
    name: t.name,
    unit: t.unit,
    ratePerUnitEur: String(t.ratePerUnitEur),
    active: t.active,
  };
}

/**
 * Lets an admin manage the shop-floor operation types used to price quote
 * lines (name, unit, €/unit, active) without a code change — this is what
 * turns "corte a laser / quinagem / soldadura / acabamento" from a hardcoded
 * enum into something the gestor can extend on their own (e.g. add "jato de
 * água" or "anodização") straight from the UI.
 */
export function OperationTypesManager({ operationTypes }: { operationTypes: OperationTypeVM[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RowForm>(EMPTY_ROW);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState<RowForm>(EMPTY_ROW);

  function startEdit(t: OperationTypeVM) {
    setError(null);
    setEditingId(t.id);
    setEditForm(toRowForm(t));
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  function payloadFrom(f: RowForm) {
    return {
      key: f.key.trim(),
      name: f.name.trim(),
      unit: f.unit.trim(),
      ratePerUnitEur: Number(f.ratePerUnitEur.replace(",", ".")),
      active: f.active,
    };
  }

  function saveEdit(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateOperationType(id, payloadFrom(editForm));
      const msg = actionError(res);
      if (msg) {
        setError(msg);
        return;
      }
      setEditingId(null);
    });
  }

  function saveNew() {
    setError(null);
    startTransition(async () => {
      const res = await createOperationType(payloadFrom(newForm));
      const msg = actionError(res);
      if (msg) {
        setError(msg);
        return;
      }
      setAdding(false);
      setNewForm(EMPTY_ROW);
    });
  }

  function remove(id: string) {
    if (!confirm("Remover este tipo de operação? Orçamentos já criados mantêm o valor guardado.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteOperationType(id);
      const msg = actionError(res);
      if (msg) setError(msg);
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 max-w-2xl">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-800">Tipos de Operação</h2>
        <p className="text-slate-500 text-xs mt-1">
          Passos de processamento (corte, quinagem, soldadura, ...) usados para
          orçamentar linhas. Adicione novos sempre que precisar, sem alterar código.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 font-medium mb-3">{error}</p>}

      <table className="w-full text-sm mb-3">
        <thead className="text-slate-400 text-xs uppercase">
          <tr>
            <th className="text-left pb-2">Nome</th>
            <th className="text-left pb-2">Un.</th>
            <th className="text-right pb-2">€/un.</th>
            <th className="text-center pb-2">Ativo</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {operationTypes.map((t) =>
            editingId === t.id ? (
              <tr key={t.id}>
                <td className="py-1.5 pr-2">
                  <input
                    className={inputCls}
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </td>
                <td className="py-1.5 pr-2 w-20">
                  <input
                    className={inputCls}
                    value={editForm.unit}
                    onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                  />
                </td>
                <td className="py-1.5 pr-2 w-24">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls + " text-right"}
                    value={editForm.ratePerUnitEur}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, ratePerUnitEur: e.target.value }))
                    }
                  />
                </td>
                <td className="py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                </td>
                <td className="py-1.5 pl-2">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => saveEdit(t.id)}
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={t.id} className={t.active ? "" : "opacity-50"}>
                <td className="py-2 text-slate-700">{t.name}</td>
                <td className="py-2 text-slate-500">{t.unit}</td>
                <td className="py-2 text-right text-slate-700">
                  {t.ratePerUnitEur.toFixed(2)} €
                </td>
                <td className="py-2 text-center text-slate-500">{t.active ? "Sim" : "Não"}</td>
                <td className="py-2">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      disabled={pending}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ),
          )}

          {adding && (
            <tr>
              <td className="py-1.5 pr-2">
                <input
                  className={inputCls}
                  placeholder="Nome (ex: Jato de água)"
                  value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                />
              </td>
              <td className="py-1.5 pr-2 w-20">
                <input
                  className={inputCls}
                  placeholder="min"
                  value={newForm.unit}
                  onChange={(e) => setNewForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </td>
              <td className="py-1.5 pr-2 w-24">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls + " text-right"}
                  value={newForm.ratePerUnitEur}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, ratePerUnitEur: e.target.value }))
                  }
                />
              </td>
              <td className="py-1.5 text-center">
                <input
                  type="checkbox"
                  checked={newForm.active}
                  onChange={(e) => setNewForm((f) => ({ ...f, active: e.target.checked }))}
                />
              </td>
              <td className="py-1.5 pl-2">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={saveNew}
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setNewForm(EMPTY_ROW);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!adding && (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setNewForm({
              ...EMPTY_ROW,
              key: `op_${Date.now().toString(36)}`,
            });
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 border border-dashed border-slate-300 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-colors"
        >
          <Plus size={14} /> Nova operação
        </button>
      )}
    </div>
  );
}
