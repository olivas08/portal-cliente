"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionError } from "@/lib/action-result";
import Link from "next/link";
import {
  Route,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { ProductBomVM, BomLineVM, MaterialVM } from "@/lib/types";
import { setProductBom } from "@/actions/materials";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";

interface Props {
  products: ProductBomVM[];
  materials: MaterialVM[];
}

export function BomManager({ products, materials }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const activeMaterials = useMemo(
    () => materials.filter((m) => m.active),
    [materials],
  );
  const materialById = useMemo(
    () => new Map(materials.map((m) => [m.id, m])),
    [materials],
  );

  const [selectedId, setSelectedId] = useState(products[0]?.id ?? "");
  const selected = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId],
  );
  const [items, setItems] = useState<BomLineVM[]>(products[0]?.items ?? []);

  const selectProduct = (id: string) => {
    setSelectedId(id);
    setItems(products.find((p) => p.id === id)?.items ?? []);
    setError(null);
    setSaved(false);
  };

  const addItem = () => {
    const used = new Set(items.map((i) => i.materialId));
    const next = activeMaterials.find((m) => !used.has(m.id));
    if (!next) return;
    setItems((prev) => [...prev, { materialId: next.id, qtyPerUnit: 1 }]);
    setSaved(false);
  };

  const updateItem = (index: number, patch: Partial<BomLineVM>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
    setSaved(false);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  const save = () => {
    if (!selected) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await setProductBom({ productId: selected.id, items });
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

  if (materials.length === 0) {
    return (
      <>
        <BreadcrumbSetter text="Fichas técnicas" />
        <p className="text-sm text-slate-500">
          Registe materiais no armazém antes de definir fichas técnicas.
        </p>
      </>
    );
  }

  return (
    <>
      <BreadcrumbSetter text="Fichas técnicas" />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <Route size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Fichas técnicas</h1>
          <p className="text-sm text-slate-500">
            Materiais consumidos por unidade de cada produto (usado para reservar
            stock ao lançar produção)
          </p>
        </div>
        <Link
          href="/admin/armazem"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Armazém
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
              <CheckCircle2 size={16} /> Ficha técnica guardada.
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-slate-500 mb-4">
              Sem materiais. Ordens de fabrico deste produto poderão ser lançadas
              sem consumo de stock.
            </p>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {items.map((it, index) => {
                const mat = materialById.get(it.materialId);
                return (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <select
                      value={it.materialId}
                      onChange={(e) =>
                        updateItem(index, { materialId: e.target.value })
                      }
                      className="flex-1 min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {activeMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.reference} — {m.name}
                        </option>
                      ))}
                      {mat && !mat.active && (
                        <option value={mat.id}>
                          {mat.reference} — {mat.name} (inativo)
                        </option>
                      )}
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={it.qtyPerUnit}
                      onChange={(e) =>
                        updateItem(index, {
                          qtyPerUnit: Number(e.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <span className="text-xs text-slate-400">
                      {mat?.unit ?? "un"} / unidade
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="ml-auto p-1.5 rounded-lg text-red-400 hover:bg-red-50"
                      aria-label="Remover material"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addItem}
              disabled={items.length >= activeMaterials.length}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <Plus size={16} /> Adicionar material
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              <Save size={16} /> Guardar ficha técnica
            </button>
          </div>
        </div>
      )}
    </>
  );
}
