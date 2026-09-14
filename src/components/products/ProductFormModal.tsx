"use client";

import { useRef } from "react";
import Image from "next/image";
import { ImageOff, Upload, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, inputCls } from "@/components/ui/Input";
import { fileToResizedDataUrl } from "@/components/products/resizeImage";

export const emptyProductForm = {
  reference: "",
  name: "",
  description: "",
  unit: "un",
  unitPriceEur: "",
  category: "",
  imageUrl: "",
  active: true,
};

export type ProductFormState = typeof emptyProductForm;

interface CompanyOption {
  id: string;
  name: string;
}

export function ProductFormModal({
  open,
  onClose,
  editing,
  form,
  setField,
  companies,
  overrides,
  setOverrides,
  error,
  imageError,
  setImageError,
  pending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  editing: boolean;
  form: ProductFormState;
  setField: <K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) => void;
  companies: CompanyOption[];
  overrides: Record<string, string>;
  setOverrides: (fn: (o: Record<string, string>) => Record<string, string>) => void;
  error: string;
  imageError: string;
  setImageError: (v: string) => void;
  pending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
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
      setField("imageUrl", await fileToResizedDataUrl(file));
    } catch {
      setImageError("Não foi possível processar a imagem.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar produto" : "Novo produto"}
      maxWidth="2xl"
      scrollable
    >
      <form onSubmit={onSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="product-ref"
            label="Referência *"
            required
            value={form.reference}
            onChange={(e) => setField("reference", e.target.value)}
          />
          <Input
            id="product-name"
            label="Nome *"
            required
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>
        <Textarea
          id="product-desc"
          label="Descrição *"
          required
          rows={2}
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            id="product-unit"
            label="Unidade *"
            required
            value={form.unit}
            onChange={(e) => setField("unit", e.target.value)}
          />
          <Input
            id="product-price"
            label="Preço base (€) *"
            required
            type="number"
            min="0"
            step="0.01"
            value={form.unitPriceEur}
            onChange={(e) => setField("unitPriceEur", e.target.value)}
          />
          <Input
            id="product-cat"
            label="Categoria"
            value={form.category}
            onChange={(e) => setField("category", e.target.value)}
          />
        </div>

        <div>
          <p className="block text-xs font-medium text-slate-600 mb-1">Imagem</p>
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
          {imageError && <p className="text-xs text-red-600 mt-1">{imageError}</p>}
        </div>

        <div>
          <p className="block text-xs font-medium text-slate-600 mb-2">
            Preços negociados por empresa (opcional)
          </p>
          <p className="text-xs text-slate-400 mb-2">Deixe vazio para usar o preço base.</p>
          <div className="space-y-2">
            {companies.map((c) => (
              <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
                <span className="col-span-8 text-sm text-slate-600 truncate">{c.name}</span>
                <div className="col-span-4 relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={form.unitPriceEur || "base"}
                    className={inputCls + " pr-6"}
                    value={overrides[c.id] ?? ""}
                    onChange={(e) =>
                      setOverrides((o) => ({ ...o, [c.id]: e.target.value }))
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

        {error && <Alert>{error}</Alert>}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? "A guardar..." : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
