"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Package, ImageOff } from "lucide-react";
import type { ProductVM } from "@/lib/types";
import { ProductsImportModal } from "@/components/ProductsImportModal";
import { actionError } from "@/lib/action-result";
import { Alert } from "@/components/ui/Alert";
import { formatEur } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import {
  createProduct,
  updateProduct,
  setProductActive,
} from "@/actions/products";
import {
  ProductFormModal,
  emptyProductForm,
  type ProductFormState,
} from "@/components/products/ProductFormModal";

interface CompanyOption {
  id: string;
  name: string;
}

interface Props {
  products: ProductVM[];
  companies: CompanyOption[];
}

export function AdminProductsView({ products, companies }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [pending, startTransition] = useTransition();

  const [optimisticProducts, applyOptimisticActive] = useOptimistic(
    products,
    (state, patch: { id: string; active: boolean }) =>
      state.map((p) => (p.id === patch.id ? { ...p, active: patch.active } : p)),
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyProductForm);
    setOverrides({});
    setError("");
    setImageError("");
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
    setImageError("");
    setOpen(true);
  };

  const setField = <K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const toggleActive = (p: ProductVM) => {
    startTransition(async () => {
      applyOptimisticActive({ id: p.id, active: !p.active });
      try {
        const res = await setProductActive(p.id, !p.active);
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          router.refresh();
          return;
        }
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ocorreu um erro. Tente novamente.",
        );
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
        const res = editingId
          ? await updateProduct(editingId, payload)
          : await createProduct(payload);
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          return;
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
        <div className="flex items-center gap-2">
          <ProductsImportModal />
          <Button variant="accent" onClick={openCreate}>
            <Plus size={16} /> Novo produto
          </Button>
        </div>
      </div>
      {error && !open && <Alert className="mb-4">{error}</Alert>}

      {optimisticProducts.length === 0 ? (
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
                {optimisticProducts.map((p) => (
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
                          <p className="font-medium text-slate-700 truncate">{p.name}</p>
                          <p className="text-xs font-mono text-slate-400">{p.reference}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.category ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {formatEur(p.unitPriceEur)}/{p.unit}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {p.companyPrices.length > 0 ? p.companyPrices.length : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(p)}
                        aria-label={p.active ? "Desativar" : "Ativar"}
                        title={p.active ? "Desativar produto" : "Ativar produto"}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-400 ${
                          p.active
                            ? "bg-emerald-500 hover:bg-emerald-600"
                            : "bg-slate-300 hover:bg-slate-400"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
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

      <ProductFormModal
        open={open}
        onClose={() => setOpen(false)}
        editing={Boolean(editingId)}
        form={form}
        setField={setField}
        companies={companies}
        overrides={overrides}
        setOverrides={setOverrides}
        error={error}
        imageError={imageError}
        setImageError={setImageError}
        pending={pending}
        onSubmit={handleSubmit}
      />
    </>
  );
}
