"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Package,
  Search,
} from "lucide-react";
import type { CatalogProductVM } from "@/lib/types";
import { placeCatalogOrder } from "@/actions/products";

interface Props {
  products: CatalogProductVM[];
}

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

export function CatalogView({ products }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  // Raw text being typed in the cart quantity fields, so a field can be
  // momentarily empty (e.g. while deleting to retype) without dropping the
  // line from the cart. Only committed to `cart` once it's a valid number.
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [expectedDate, setExpectedDate] = useState("");
  const [observations, setObservations] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const visible = products.filter((p) => {
    const matchesCat = category === "all" || p.category === category;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.reference.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  const cartLines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ product: byId.get(id)!, qty }))
    .filter((l) => l.product);

  const total = cartLines.reduce(
    (sum, l) => sum + l.qty * l.product.unitPriceEur,
    0,
  );

  const clearDraft = (id: string) =>
    setQtyDraft((d) => {
      if (!(id in d)) return d;
      const next = { ...d };
      delete next[id];
      return next;
    });

  const setQty = (id: string, qty: number) => {
    setCart((c) => ({ ...c, [id]: Math.max(0, qty) }));
    clearDraft(id);
  };

  const add = (id: string) => {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
    clearDraft(id);
  };

  // Cart quantity field: keep the raw text so it can be empty mid-edit, and
  // only update the cart when it parses to a valid quantity (>= 1).
  const onCartQtyChange = (id: string, raw: string) => {
    setQtyDraft((d) => ({ ...d, [id]: raw }));
    const n = parseInt(raw, 10);
    if (raw !== "" && Number.isInteger(n) && n >= 1) {
      setCart((c) => ({ ...c, [id]: n }));
    }
  };

  // On blur, drop the draft (falls back to the committed qty) and guarantee at
  // least 1 so an emptied field never leaves a zero-quantity line.
  const onCartQtyBlur = (id: string) => {
    clearDraft(id);
    setCart((c) => ({ ...c, [id]: Math.max(1, Math.floor(c[id] || 1)) }));
  };

  const remove = (id: string) => {
    clearDraft(id);
    setCart((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
  };

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const id = await placeCatalogOrder({
          expectedDate,
          observations: observations || undefined,
          items: cartLines.map((l) => ({
            productId: l.product.id,
            quantity: l.qty,
          })),
        });
        router.push(`/dashboard/ordens/${id}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ocorreu um erro. Tente novamente.",
        );
      }
    });
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Catálogo</h1>
        <p className="text-slate-500 text-sm mt-1">
          Escolha os produtos e finalize a sua encomenda
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Products */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className={inputCls + " pl-9"}
                placeholder="Procurar por nome ou referência..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {categories.length > 0 && (
              <select
                className={inputCls + " sm:w-52"}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
              <Package className="mx-auto text-slate-300" size={40} />
              <p className="text-slate-500 text-sm mt-3">
                Nenhum produto encontrado.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {visible.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col"
                >
                  <div className="h-32 bg-slate-100 flex items-center justify-center overflow-hidden">
                    {p.imageUrl ? (
                      <Image
                        src={p.imageUrl}
                        alt={p.name}
                        width={320}
                        height={128}
                        className="object-cover h-32 w-full"
                        unoptimized
                      />
                    ) : (
                      <Package size={28} className="text-slate-300" />
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    {p.category && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {p.category}
                      </span>
                    )}
                    <p className="font-semibold text-slate-800 leading-tight">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 flex-1">
                      {p.description}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-sm font-bold text-brand">
                        {p.unitPriceEur.toFixed(2)} €
                        <span className="text-xs font-normal text-slate-400">
                          /{p.unit}
                        </span>
                      </p>
                      {cart[p.id] ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQty(p.id, (cart[p.id] ?? 0) - 1)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                            aria-label={`Diminuir ${p.name}`}
                          >
                            <Minus size={13} />
                          </button>
                          <span className="text-sm font-semibold w-6 text-center">
                            {cart[p.id]}
                          </span>
                          <button
                            onClick={() => add(p.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                            aria-label={`Aumentar ${p.name}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => add(p.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-brand text-xs font-semibold rounded-lg hover:bg-accent-dark"
                        >
                          <Plus size={13} /> Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <form
          onSubmit={handleCheckout}
          className="bg-white rounded-2xl border border-slate-100 p-5 lg:sticky lg:top-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-slate-800">
            <ShoppingCart size={18} />
            <h2 className="font-semibold">Carrinho</h2>
            {cartLines.length > 0 && (
              <span className="ml-auto text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                {cartLines.length}
              </span>
            )}
          </div>

          {cartLines.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              O carrinho está vazio. Adicione produtos do catálogo.
            </p>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cartLines.map(({ product, qty }) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {qty} × {product.unitPriceEur.toFixed(2)} € ={" "}
                        {(qty * product.unitPriceEur).toFixed(2)} €
                      </p>
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={qtyDraft[product.id] ?? String(qty)}
                      onChange={(e) => onCartQtyChange(product.id, e.target.value)}
                      onBlur={() => onCartQtyBlur(product.id)}
                      className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white"
                      aria-label={`Quantidade de ${product.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => remove(product.id)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`Remover ${product.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-100">
                <span className="text-slate-500">Total (s/ IVA)</span>
                <strong className="text-brand">{total.toFixed(2)} €</strong>
              </div>

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
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  className={inputCls + " resize-none"}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Alguma indicação para esta encomenda..."
                />
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                A encomenda será criada em estado <strong>Pendente</strong> e
                confirmada pela fábrica.
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full px-4 py-2.5 text-sm font-semibold text-brand bg-accent rounded-lg hover:bg-accent-dark disabled:opacity-60"
              >
                {pending ? "A criar encomenda..." : "Finalizar encomenda"}
              </button>
            </>
          )}
        </form>
      </div>
    </>
  );
}
