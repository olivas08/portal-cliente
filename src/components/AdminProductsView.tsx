"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, X, Package, ImageOff, Upload, Trash2 } from "lucide-react";
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

// Downscale an uploaded image in the browser and return a compact JPEG data URL,
// so it can be stored inline in the DB without any external storage service.
async function fileToResizedDataUrl(
  file: File,
  maxDim = 512,
  quality = 0.8,
): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("decode"));
    el.src = original;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function AdminProductsView({ products, companies }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
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

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setImageError("");
    if (!file.type.startsWith("image/")) {
      setImageError("Selecione um ficheiro de imagem.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError("Imagem demasiado grande (máx. 8 MB).");
      return;
    }
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setField("imageUrl", dataUrl);
    } catch {
      setImageError("Não foi possível processar a imagem.");
    }
  };

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
                  Imagem
                </label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                    {form.imageUrl ? (
                      <Image
                        src={form.imageUrl}
                        alt="Pré-visualização"
                        width={64}
                        height={64}
                        className="object-cover h-16 w-16"
                        unoptimized
                      />
                    ) : (
                      <ImageOff size={18} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      <Upload size={14} />
                      {form.imageUrl ? "Trocar imagem" : "Carregar imagem"}
                    </button>
                    {form.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setField("imageUrl", "")}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600"
                      >
                        <Trash2 size={12} /> Remover
                      </button>
                    )}
                  </div>
                </div>
                {imageError && (
                  <p className="text-xs text-red-600 mt-1">{imageError}</p>
                )}
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
