"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Route,
  ArrowLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type {
  ProductRoutingVM,
  RoutingOperationVM,
  WorkstationOptionVM,
} from "@/lib/types";
import { setProductRouting } from "@/actions/production";
import { actionError } from "@/lib/action-result";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";

interface Props {
  products: ProductRoutingVM[];
  workstations: WorkstationOptionVM[];
}

export function RoutingManager({ products, workstations }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [selectedId, setSelectedId] = useState(products[0]?.id ?? "");
  const selected = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId],
  );
  const [ops, setOps] = useState<RoutingOperationVM[]>(
    products[0]?.operations ?? [],
  );

  const selectProduct = (id: string) => {
    setSelectedId(id);
    setOps(products.find((p) => p.id === id)?.operations ?? []);
    setError(null);
    setSaved(false);
  };

  const addOp = () => {
    const ws = workstations[0];
    if (!ws) return;
    setOps((prev) => [
      ...prev,
      { name: ws.name, workstationId: ws.id, plannedMinutes: 30 },
    ]);
    setSaved(false);
  };

  const updateOp = (index: number, patch: Partial<RoutingOperationVM>) => {
    setOps((prev) =>
      prev.map((op, i) => (i === index ? { ...op, ...patch } : op)),
    );
    setSaved(false);
  };

  const removeOp = (index: number) => {
    setOps((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  const moveOp = (index: number, delta: number) => {
    setOps((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  };

  const save = () => {
    if (!selected) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await setProductRouting({ productId: selected.id, operations: ops });
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          return;
        }
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  if (workstations.length === 0) {
    return (
      <>
        <BreadcrumbSetter text="Roteiros" />
        <p className="text-sm text-slate-500">
          Configure postos de trabalho antes de definir roteiros.
        </p>
      </>
    );
  }

  return (
    <>
      <BreadcrumbSetter text="Roteiros" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <Route size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Roteiros</h1>
          <p className="text-sm text-slate-500">
            Sequência de operações por produto para gerar ordens de fabrico
          </p>
        </div>
        <Link
          href="/admin/producao"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Produção
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-slate-500">
          Não existem produtos no catálogo.
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Produto
          </label>
          <select
            value={selectedId}
            onChange={(e) => selectProduct(e.target.value)}
            className="w-full sm:w-96 rounded-lg border border-slate-200 px-3 py-2 text-sm mb-5"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.reference})
              </option>
            ))}
          </select>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 text-sm text-red-700">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {saved && !error && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 mb-4 text-sm text-emerald-700">
              <CheckCircle2 size={16} /> Roteiro guardado.
            </div>
          )}

          {ops.length === 0 ? (
            <p className="text-sm text-slate-500 mb-4">
              Sem operações. Ordens de fabrico usarão todos os postos ativos por
              defeito.
            </p>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {ops.map((op, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span className="w-6 text-center text-sm font-semibold text-slate-400">
                    {index + 1}
                  </span>
                  <input
                    value={op.name}
                    onChange={(e) => updateOp(index, { name: e.target.value })}
                    placeholder="Nome da operação"
                    className="flex-1 min-w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <select
                    value={op.workstationId}
                    onChange={(e) =>
                      updateOp(index, { workstationId: e.target.value })
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {workstations.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={op.plannedMinutes}
                    onChange={(e) =>
                      updateOp(index, {
                        plannedMinutes: Number(e.target.value),
                      })
                    }
                    className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <span className="text-xs text-slate-400">min</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveOp(index, -1)}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveOp(index, 1)}
                      disabled={index === ops.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOp(index)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"
                      aria-label="Remover operação"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addOp}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus size={16} /> Adicionar operação
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              <Save size={16} /> Guardar roteiro
            </button>
          </div>
        </div>
      )}
    </>
  );
}
