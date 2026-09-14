"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  Warehouse,
  Plus,
  PackagePlus,
  AlertTriangle,
  Pencil,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { MaterialVM, MaterialBatchVM } from "@/lib/types";
import { actionError } from "@/lib/action-result";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { formatInstantPt } from "@/lib/format";
import { MaterialsImportModal } from "@/components/MaterialsImportModal";
import {
  createMaterial,
  updateMaterial,
  receiveStock,
  receiveMaterialBatch,
  getMaterialBatchesAction,
} from "@/actions/materials";
import { fmtQty } from "@/components/warehouse/fmt";

export function MaterialsStockSection({ materials }: { materials: MaterialVM[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [nref, setNref] = useState("");
  const [nname, setNname] = useState("");
  const [nunit, setNunit] = useState("un");
  const [nmin, setNmin] = useState(0);
  const [nqty, setNqty] = useState(0);
  const [ntracks, setNtracks] = useState(false);

  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState(0);

  const [batchReceiveId, setBatchReceiveId] = useState<string | null>(null);
  const [bCode, setBCode] = useState("");
  const [bQty, setBQty] = useState(0);
  const [bSupplier, setBSupplier] = useState("");
  const [bCert, setBCert] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [ename, setEname] = useState("");
  const [eunit, setEunit] = useState("un");
  const [emin, setEmin] = useState(0);
  const [eactive, setEactive] = useState(true);
  const [etracks, setEtracks] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [batchesByMaterial, setBatchesByMaterial] = useState<
    Record<string, MaterialBatchVM[]>
  >({});
  const [loadingBatches, setLoadingBatches] = useState(false);

  const run = (fn: () => Promise<unknown>, okMsg?: string) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await fn();
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          return;
        }
        if (okMsg) setNotice(okMsg);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  const lowStock = materials.filter((m) => m.belowMin).length;

  return (
    <section className="mb-8">
      {error && <Alert className="mb-4">{error}</Alert>}
      {notice && !error && (
        <Alert tone="success" className="mb-4">
          {notice}
        </Alert>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Warehouse size={16} /> Stock de matérias-primas
          {lowStock > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <AlertTriangle size={12} /> {lowStock} abaixo do mínimo
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <MaterialsImportModal />
          <Button variant="secondary" onClick={() => setShowNew((v) => !v)}>
            <Plus size={16} /> Novo material
          </Button>
        </div>
      </div>

      {showNew && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Referência
            <input
              value={nref}
              onChange={(e) => setNref(e.target.value)}
              placeholder="MAT-001"
              className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 flex-1 min-w-40">
            Nome
            <input
              value={nname}
              onChange={(e) => setNname(e.target.value)}
              placeholder="Chapa de aço 2mm"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Unidade
            <input
              value={nunit}
              onChange={(e) => setNunit(e.target.value)}
              className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Stock inicial
            <input
              type="number"
              min={0}
              value={ntracks ? 0 : nqty}
              disabled={ntracks}
              onChange={(e) => setNqty(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Stock mínimo
            <input
              type="number"
              min={0}
              value={nmin}
              onChange={(e) => setNmin(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2.5">
            <input
              type="checkbox"
              checked={ntracks}
              onChange={(e) => setNtracks(e.target.checked)}
            />
            Rastreia lotes (lote/colada)
          </label>
          <Button
            onClick={() =>
              run(async () => {
                await createMaterial({
                  reference: nref,
                  name: nname,
                  unit: nunit,
                  minStockQty: nmin,
                  initialQty: ntracks ? 0 : nqty,
                  tracksBatches: ntracks,
                });
                setShowNew(false);
                setNref("");
                setNname("");
                setNunit("un");
                setNmin(0);
                setNqty(0);
                setNtracks(false);
              }, "Material criado.")
            }
            disabled={pending}
          >
            <Plus size={16} /> Criar
          </Button>
        </div>
      )}

      {materials.length === 0 ? (
        <p className="text-sm text-slate-500">Ainda não há materiais registados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Referência</th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium text-right">Mínimo</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <Fragment key={m.id}>
                  <tr
                    className={`border-b border-slate-50 last:border-0 ${
                      !m.active ? "opacity-50" : ""
                    } ${m.belowMin ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="px-2 py-3">
                      {m.tracksBatches && (
                        <button
                          type="button"
                          onClick={() => {
                            if (expandedId === m.id) {
                              setExpandedId(null);
                              return;
                            }
                            setExpandedId(m.id);
                            if (batchesByMaterial[m.id]) return;
                            setLoadingBatches(true);
                            startTransition(async () => {
                              try {
                                const batches = await getMaterialBatchesAction(m.id);
                                setBatchesByMaterial((prev) => ({
                                  ...prev,
                                  [m.id]: batches,
                                }));
                              } catch (e) {
                                setError(
                                  e instanceof Error ? e.message : "Ocorreu um erro.",
                                );
                              } finally {
                                setLoadingBatches(false);
                              }
                            });
                          }}
                          aria-label="Ver lotes"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                        >
                          {expandedId === m.id ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {m.reference}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {m.name}
                      {m.tracksBatches && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          <Layers size={10} /> lotes
                        </span>
                      )}
                      {!m.active && (
                        <span className="ml-2 text-xs text-slate-400">(inativo)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span
                        className={
                          m.belowMin ? "font-semibold text-amber-700" : "text-slate-700"
                        }
                      >
                        {fmtQty(m.stockQty)}
                      </span>{" "}
                      <span className="text-xs text-slate-400">{m.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                      {fmtQty(m.minStockQty)}
                    </td>
                    <td className="px-4 py-3">
                      {batchReceiveId === m.id ? (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <input
                            autoFocus
                            value={bCode}
                            onChange={(e) => setBCode(e.target.value)}
                            placeholder="Nº lote/colada"
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <input
                            type="number"
                            min={0}
                            value={bQty}
                            onChange={(e) => setBQty(Number(e.target.value))}
                            placeholder="Qtd"
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <input
                            value={bSupplier}
                            onChange={(e) => setBSupplier(e.target.value)}
                            placeholder="Fornecedor"
                            className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <input
                            value={bCert}
                            onChange={(e) => setBCert(e.target.value)}
                            placeholder="Nº certificado"
                            className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              run(async () => {
                                await receiveMaterialBatch({
                                  materialId: m.id,
                                  batchCode: bCode,
                                  qty: bQty,
                                  supplierName: bSupplier || undefined,
                                  certificateRef: bCert || undefined,
                                });
                                setBatchReceiveId(null);
                                setBCode("");
                                setBQty(0);
                                setBSupplier("");
                                setBCert("");
                                setBatchesByMaterial((prev) => {
                                  const next = { ...prev };
                                  delete next[m.id];
                                  return next;
                                });
                              }, "Lote recebido.")
                            }
                            disabled={pending || !bCode.trim() || bQty <= 0}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                          >
                            Registar
                          </button>
                          <button
                            type="button"
                            onClick={() => setBatchReceiveId(null)}
                            className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : receiveId === m.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            min={0}
                            autoFocus
                            value={receiveQty}
                            onChange={(e) => setReceiveQty(Number(e.target.value))}
                            className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              run(async () => {
                                await receiveStock({ materialId: m.id, qty: receiveQty });
                                setReceiveId(null);
                                setReceiveQty(0);
                              }, "Entrada de stock registada.")
                            }
                            disabled={pending || receiveQty <= 0}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                          >
                            Registar
                          </button>
                          <button
                            type="button"
                            onClick={() => setReceiveId(null)}
                            className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : editId === m.id ? (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <input
                            value={ename}
                            onChange={(e) => setEname(e.target.value)}
                            className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <input
                            value={eunit}
                            onChange={(e) => setEunit(e.target.value)}
                            className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <input
                            type="number"
                            min={0}
                            value={emin}
                            onChange={(e) => setEmin(Number(e.target.value))}
                            title="Stock mínimo"
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <label className="flex items-center gap-1 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={eactive}
                              onChange={(e) => setEactive(e.target.checked)}
                            />
                            Ativo
                          </label>
                          <label className="flex items-center gap-1 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={etracks}
                              onChange={(e) => setEtracks(e.target.checked)}
                            />
                            Rastreia lotes
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              run(async () => {
                                await updateMaterial({
                                  materialId: m.id,
                                  name: ename,
                                  unit: eunit,
                                  minStockQty: emin,
                                  active: eactive,
                                  tracksBatches: etracks,
                                });
                                setEditId(null);
                              }, "Material atualizado.")
                            }
                            disabled={pending}
                            className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditId(null)}
                            className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (m.tracksBatches) {
                                setBatchReceiveId(m.id);
                                setBCode("");
                                setBQty(0);
                                setBSupplier("");
                                setBCert("");
                              } else {
                                setReceiveId(m.id);
                                setReceiveQty(0);
                              }
                              setError(null);
                              setNotice(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            <PackagePlus size={14} />{" "}
                            {m.tracksBatches ? "Receber lote" : "Receber"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditId(m.id);
                              setEname(m.name);
                              setEunit(m.unit);
                              setEmin(m.minStockQty);
                              setEactive(m.active);
                              setEtracks(m.tracksBatches);
                              setError(null);
                              setNotice(null);
                            }}
                            aria-label="Editar material"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedId === m.id && (
                    <tr className="bg-slate-50/60">
                      <td></td>
                      <td colSpan={5} className="px-4 py-3">
                        {loadingBatches && !batchesByMaterial[m.id] ? (
                          <p className="text-xs text-slate-400">A carregar lotes…</p>
                        ) : !batchesByMaterial[m.id]?.length ? (
                          <p className="text-xs text-slate-400">
                            Ainda não há lotes recebidos.
                          </p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-400">
                                <th className="py-1 pr-4 font-medium">Lote</th>
                                <th className="py-1 pr-4 font-medium">Fornecedor</th>
                                <th className="py-1 pr-4 font-medium">Certificado</th>
                                <th className="py-1 pr-4 font-medium text-right">
                                  Recebido
                                </th>
                                <th className="py-1 pr-4 font-medium text-right">
                                  Restante
                                </th>
                                <th className="py-1 font-medium">Data</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchesByMaterial[m.id].map((b) => (
                                <tr key={b.id} className="border-t border-slate-100">
                                  <td className="py-1.5 pr-4 font-medium text-slate-700">
                                    {b.batchCode}
                                  </td>
                                  <td className="py-1.5 pr-4 text-slate-500">
                                    {b.supplierName ?? "—"}
                                  </td>
                                  <td className="py-1.5 pr-4 text-slate-500">
                                    {b.certificateRef ?? "—"}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right tabular-nums text-slate-600">
                                    {fmtQty(b.receivedQty)} {b.unit}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right tabular-nums text-slate-600">
                                    {fmtQty(b.remainingQty)} {b.unit}
                                  </td>
                                  <td className="py-1.5 text-slate-400 whitespace-nowrap">
                                    {formatInstantPt(b.receivedAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
