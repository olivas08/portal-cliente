"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, X, Package, ImageOff } from "lucide-react";
import type { ProductVM } from "@/lib/types";
import {
  createProduct,
  updateProduct,
  setProductActive,
} from "@/actions/products";

interface CompanyOption {
  id: string;
  name: string;
}

interface Props {
  products: ProductVM[];
  companies: CompanyOption[];
}

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

const emptyForm = {
  reference: "",
  name: "",
  description: "",
  unit: "un",
  unitPriceEur: "",
  category: "",
  imageUrl: "",
  active: true,
};

type FormState = typeof emptyForm;

export function AdminProductsView({ products, companies }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOverrides({});
    setError("");
    setOpen(true);
  };

  const openEdit = (p: ProductVM) => {
    setEditingId(p.id);
    setForm({
      reference: p.reference,
      name: p.name,
      description: p.description,
      unit: p.unit,
      unitPriceEur: String(p.unitPriceEur),
      category: p.category ?? "",
      imageUrl: p.imageUrl ?? "",
      active: p.active,
    });
    setOverrides(
      Object.fromEntries(
        p.companyPrices.map((cp) => [cp.companyId, String(cp.unitPriceEur)]),
      ),
    );
    setError("");
    setOpen(true);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleActive = (p: ProductVM) => {
    startTransition(async () => {
      try {
        await setProductActive(p.id, !p.active);
        router.refresh();
      } catch {
        /* best-effort UI; refresh keeps state consistent */
        router.refresh();
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const companyPrices = companies
      .filter((c) => overrides[c.id]?.trim())
      .map((c) => ({ companyId: c.id, unitPriceEur: Number(overrides[c.id]) }));

    const payload = {
      reference: form.reference,
      name: form.name,
      description: form.description,
      unit: form.unit,
      unitPriceEur: Number(form.unitPriceEur),
      category: form.category || undefined,
      imageUrl: form.imageUrl || undefined,
      active: form.active,
      companyPrices,
    };

    startTransition(async () => {
      try {
        if (editingId) {
          await updateProduct(editingId, payload);
        } else {
          await createProduct(payload);
        }
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ocorreu um erro. Tente novamente.",
        );
      }
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Produtos</h1>
          <p className="text-slate-500 text-sm mt-1">
            Catálogo que os clientes veem no portal
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-brand text-sm font-semibold rounded-lg hover:bg-accent-dark transition-colors"
        >
          <Plus size={16} /> Novo produto
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <Package className="mx-auto text-slate-300" size={40} />
          <p className="text-slate-500 text-sm mt-3">
            Ainda não há produtos. Crie o primeiro para o mostrar no catálogo.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium text-right">Preço base</th>
                  <th className="px-4 py-3 font-medium text-center">Preços/empresa</th>
                  <th className="px-4 py-3 font-medium text-center">Ativo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {products.map((p) => (
                  <tr key={p.id} className={p.active ? "" : "opacity-60"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.imageUrl ? (
                            <Image
                              src={p.imageUrl}
                              alt={p.name}
                              width={40}
                              height={40}
                              className="object-cover h-10 w-10"
                              unoptimized
                            />
                          ) : (
                            <ImageOff size={16} className="text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700 truncate">
                            {p.name}
                          </p>
                          <p className="text-xs font-mono text-slate-400">
                            {p.reference}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.category ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {p.unitPriceEur.toFixed(2)} €/{p.unit}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {p.companyPrices.length > 0 ? p.companyPrices.length : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(p)}
                        disabled={pending}
                        aria-label={p.active ? "Desativar" : "Ativar"}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          p.active ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            p.active ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-slate-400 hover:text-brand"
                        aria-label={`Editar ${p.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? "Editar produto" : "Novo produto"}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-slate-800">
                {editingId ? "Editar produto" : "Novo produto"}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Referência *
                  </label>
                  <input
                    required
                    className={inputCls}
                    value={form.reference}
                    onChange={(e) => setField("reference", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nome *
                  </label>
                  <input
                    required
                    className={inputCls}
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Descrição *
                </label>
                <textarea
                  required
                  rows={2}
                  className={inputCls + " resize-none"}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Unidade *
                  </label>
                  <input
                    required
                    className={inputCls}
                    value={form.unit}
                    onChange={(e) => setField("unit", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Preço base (€) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    value={form.unitPriceEur}
                    onChange={(e) => setField("unitPriceEur", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Categoria
                  </label>
                  <input
                    className={inputCls}
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  URL da imagem
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  className={inputCls}
                  value={form.imageUrl}
                  onChange={(e) => setField("imageUrl", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Preços negociados por empresa (opcional)
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Deixe vazio para usar o preço base.
                </p>
                <div className="space-y-2">
                  {companies.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <span className="col-span-8 text-sm text-slate-600 truncate">
                        {c.name}
                      </span>
                      <div className="col-span-4 relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={form.unitPriceEur || "base"}
                          className={inputCls + " pr-6"}
                          value={overrides[c.id] ?? ""}
                          onChange={(e) =>
                            setOverrides((o) => ({
                              ...o,
                              [c.id]: e.target.value,
                            }))
                          }
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                          €
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setField("active", e.target.checked)}
                  className="rounded border-slate-300"
                />
                Visível no catálogo do cliente
              </label>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 text-sm font-semibold text-brand bg-accent rounded-lg hover:bg-accent-dark disabled:opacity-60"
                >
                  {pending ? "A guardar..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
