"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { actionError } from "@/lib/action-result";
import Link from "next/link";
import {
  Warehouse,
  Plus,
  PackagePlus,
  PackageCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowRightLeft,
  Route,
  Pencil,
  Layers,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import type {
  MaterialVM,
  WorkOrderReadinessVM,
  StockMovementVM,
  MaterialBatchVM,
} from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import {
  createMaterial,
  updateMaterial,
  receiveStock,
  receiveMaterialBatch,
  getMaterialBatchesAction,
} from "@/actions/materials";
import { releaseWorkOrder } from "@/actions/production";
import { MaterialsImportModal } from "@/components/MaterialsImportModal";

interface Props {
  materials: MaterialVM[];
  awaiting: WorkOrderReadinessVM[];
  movements: StockMovementVM[];
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function WarehouseView({ materials, awaiting, movements }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New material form
  const [showNew, setShowNew] = useState(false);
  const [nref, setNref] = useState("");
  const [nname, setNname] = useState("");
  const [nunit, setNunit] = useState("un");
  const [nmin, setNmin] = useState(0);
  const [nqty, setNqty] = useState(0);
  const [ntracks, setNtracks] = useState(false);

  // Receive stock (untracked materials)
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState(0);

  // Receive batch (tracksBatches materials)
  const [batchReceiveId, setBatchReceiveId] = useState<string | null>(null);
  const [bCode, setBCode] = useState("");
  const [bQty, setBQty] = useState(0);
  const [bSupplier, setBSupplier] = useState("");
  const [bCert, setBCert] = useState("");

  // Edit material
  const [editId, setEditId] = useState<string | null>(null);
  const [ename, setEname] = useState("");
  const [eunit, setEunit] = useState("un");
  const [emin, setEmin] = useState(0);
  const [eactive, setEactive] = useState(true);
  const [etracks, setEtracks] = useState(false);

  // Batch history (expandable per tracked material)
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

  const submitNew = () => {
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
    }, "Material criado.");
  };

  const submitReceive = (id: string) => {
    run(async () => {
      await receiveStock({ materialId: id, qty: receiveQty });
      setReceiveId(null);
      setReceiveQty(0);
    }, "Entrada de stock registada.");
  };

  const submitBatchReceive = (id: string) => {
    run(async () => {
      await receiveMaterialBatch({
        materialId: id,
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
      // Force a refetch of this material's batch list next time it's expanded.
      setBatchesByMaterial((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, "Lote recebido.");
  };

  const toggleBatches = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (batchesByMaterial[id]) return;
    setLoadingBatches(true);
    startTransition(async () => {
      try {
        const batches = await getMaterialBatchesAction(id);
        setBatchesByMaterial((prev) => ({ ...prev, [id]: batches }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      } finally {
        setLoadingBatches(false);
      }
    });
  };

  const openEdit = (m: MaterialVM) => {
    setEditId(m.id);
    setEname(m.name);
    setEunit(m.unit);
    setEmin(m.minStockQty);
    setEactive(m.active);
    setEtracks(m.tracksBatches);
    setError(null);
    setNotice(null);
  };

  const submitEdit = (id: string) => {
    run(async () => {
      await updateMaterial({
        materialId: id,
        name: ename,
        unit: eunit,
        minStockQty: emin,
        active: eactive,
        tracksBatches: etracks,
      });
      setEditId(null);
    }, "Material atualizado.");
  };

  const release = (wo: WorkOrderReadinessVM) => {
    run(
      () => releaseWorkOrder(wo.id),
      `Ordem ${wo.reference} lançada para produção.`,
    );
  };

  const lowStock = materials.filter((m) => m.belowMin).length;

  return (
    <>
      <BreadcrumbSetter text="Armazém" />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <Warehouse size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Armazém</h1>
          <p className="text-sm text-slate-500">
            Controlo de matérias-primas e confirmação de stock antes de lançar
            produção
          </p>
        </div>
        <Link
          href="/admin/armazem/rastreabilidade"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Search size={16} /> Rastreabilidade
        </Link>
        <Link
          href="/admin/armazem/fichas-tecnicas"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Route size={16} /> Fichas técnicas
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {notice && !error && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 mb-4 text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      {/* ── Ordens a aguardar materiais ──────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <PackageCheck size={16} /> Ordens a aguardar confirmação de stock
          <span className="text-xs font-normal text-slate-400">
            ({awaiting.length})
          </span>
        </h2>

        {awaiting.length === 0 ? (
          <p className="text-sm text-slate-500">
            Não há ordens de fabrico planeadas a aguardar lançamento.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {awaiting.map((wo) => (
              <div
                key={wo.id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  wo.canRelease ? "border-slate-100" : "border-amber-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {wo.reference}{" "}
                      <span className="text-slate-400 font-normal">
                        · {wo.productRef}
                      </span>
                    </p>
                    <p className="text-sm text-slate-500">
                      {wo.productName} · {fmt(wo.quantityPlanned)} un
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {wo.orderReference} · {wo.companyName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => release(wo)}
                    disabled={pending || !wo.canRelease}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
                  >
                    <PackageCheck size={15} /> Confirmar e lançar
                  </button>
                </div>

                {!wo.hasBom ? (
                  <p className="text-xs text-slate-400">
                    Sem ficha técnica — pode lançar sem consumo de materiais.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {wo.materials.map((m) => (
                      <div
                        key={m.materialId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-600">
                          {m.reference}{" "}
                          <span className="text-slate-400">— {m.name}</span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 tabular-nums ${
                            m.enough ? "text-slate-600" : "text-red-600"
                          }`}
                        >
                          {m.enough ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <AlertTriangle size={14} className="text-red-500" />
                          )}
                          {fmt(m.requiredQty)} / {fmt(m.availableQty)} {m.unit}
                          {!m.enough && (
                            <span className="text-xs">
                              (faltam {fmt(m.missingQty)})
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Stock de materiais ───────────────────────────────────────── */}
      <section className="mb-8">
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
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus size={16} /> Novo material
            </button>
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
            <button
              type="button"
              onClick={submitNew}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              <Plus size={16} /> Criar
            </button>
          </div>
        )}

        {materials.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ainda não há materiais registados.
          </p>
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
                      key={m.id}
                      className={`border-b border-slate-50 last:border-0 ${
                        !m.active ? "opacity-50" : ""
                      } ${m.belowMin ? "bg-amber-50/40" : ""}`}
                    >
                      <td className="px-2 py-3">
                        {m.tracksBatches && (
                          <button
                            type="button"
                            onClick={() => toggleBatches(m.id)}
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
                          <span
                            title="Rastreia lotes/coladas"
                            className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                          >
                            <Layers size={10} /> lotes
                          </span>
                        )}
                        {!m.active && (
                          <span className="ml-2 text-xs text-slate-400">
                            (inativo)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={
                            m.belowMin
                              ? "font-semibold text-amber-700"
                              : "text-slate-700"
                          }
                        >
                          {fmt(m.stockQty)}
                        </span>{" "}
                        <span className="text-xs text-slate-400">{m.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                        {fmt(m.minStockQty)}
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
                              onClick={() => submitBatchReceive(m.id)}
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
                              onChange={(e) =>
                                setReceiveQty(Number(e.target.value))
                              }
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => submitReceive(m.id)}
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
                              onClick={() => submitEdit(m.id)}
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
                              onClick={() => openEdit(m)}
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
                      <tr key={`${m.id}-batches`} className="bg-slate-50/60">
                        <td></td>
                        <td colSpan={5} className="px-4 py-3">
                          {loadingBatches && !batchesByMaterial[m.id] ? (
                            <p className="text-xs text-slate-400">
                              A carregar lotes…
                            </p>
                          ) : !batchesByMaterial[m.id]?.length ? (
                            <p className="text-xs text-slate-400">
                              Ainda não há lotes recebidos.
                            </p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-slate-400">
                                  <th className="py-1 pr-4 font-medium">Lote</th>
                                  <th className="py-1 pr-4 font-medium">
                                    Fornecedor
                                  </th>
                                  <th className="py-1 pr-4 font-medium">
                                    Certificado
                                  </th>
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
                                      {fmt(b.receivedQty)} {b.unit}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right tabular-nums text-slate-600">
                                      {fmt(b.remainingQty)} {b.unit}
                                    </td>
                                    <td className="py-1.5 text-slate-400 whitespace-nowrap">
                                      {new Date(b.receivedAt).toLocaleDateString(
                                        "pt-PT",
                                      )}
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

      {/* ── Movimentos recentes ──────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <ArrowRightLeft size={16} /> Movimentos recentes
        </h2>
        {movements.length === 0 ? (
          <p className="text-sm text-slate-500">Sem movimentos registados.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Material</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium text-right">Quantidade</th>
                  <th className="px-4 py-3 font-medium">Nota</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mv) => (
                  <tr
                    key={mv.id}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(mv.createdAt).toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {mv.materialRef}{" "}
                      <span className="text-slate-400">— {mv.materialName}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{mv.reasonLabel}</td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${
                        mv.delta >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {mv.delta >= 0 ? "+" : ""}
                      {fmt(mv.delta)} {mv.unit}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {mv.workOrderRef ? `${mv.workOrderRef} · ` : ""}
                      {mv.note ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
