import Link from "next/link";
import { Search, ArrowLeft, PackageSearch, AlertTriangle } from "lucide-react";
import type { RecallTraceVM } from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";

interface Props {
  query: string;
  results: RecallTraceVM[];
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * Recall search: type a batch/heat code (or part of one) and see every order,
 * across every client, that consumed it — the backward view over the
 * `WorkOrderMaterialBatch` ledger. Read-only, no client JS needed beyond the
 * GET form (search happens server-side via the `q` query param).
 */
export function RecallSearchView({ query, results }: Props) {
  return (
    <>
      <BreadcrumbSetter text="Rastreabilidade" />
      <Link
        href="/admin/armazem"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5 w-fit"
      >
        <ArrowLeft size={16} /> Voltar ao armazém
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <PackageSearch size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Rastreabilidade de lotes
          </h1>
          <p className="text-sm text-slate-500">
            Pesquise por um nº de lote/colada para ver que encomendas o
            consumiram — útil em caso de recall de um fornecedor.
          </p>
        </div>
      </div>

      <form
        method="get"
        className="flex items-center gap-2 mb-6 max-w-md"
      >
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Nº de lote/colada (ex: HT-2024-118)"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          <Search size={16} /> Pesquisar
        </button>
      </form>

      {query && results.length === 0 && (
        <p className="text-sm text-slate-500">
          Nenhum lote encontrado para &ldquo;{query}&rdquo;.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {results.map((r) => (
          <div
            key={r.batchId}
            className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
              <div>
                <p className="font-semibold text-slate-800">
                  Lote {r.batchCode}{" "}
                  <span className="text-slate-400 font-normal">
                    · {r.materialRef} — {r.materialName}
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {r.supplierName ? `Fornecedor: ${r.supplierName}` : ""}
                  {r.supplierName && r.certificateRef ? " · " : ""}
                  {r.certificateRef ? `Certificado: ${r.certificateRef}` : ""}
                  {" · "}
                  Recebido em{" "}
                  {new Date(r.receivedAt).toLocaleDateString("pt-PT")}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>
                  Recebido: {fmt(r.receivedQty)} {r.unit}
                </p>
                <p>
                  Restante: {fmt(r.remainingQty)} {r.unit}
                </p>
              </div>
            </div>

            {r.consumedIn.length === 0 ? (
              <p className="text-xs text-slate-400">
                Ainda não foi consumido em nenhuma ordem de fabrico.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-400">
                      <th className="px-3 py-2 font-medium">Ordem de fabrico</th>
                      <th className="px-3 py-2 font-medium">Encomenda</th>
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium">Produto</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Qtd. consumida
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.consumedIn.map((c, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2 font-medium text-slate-700">
                          {c.workOrderRef}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {c.orderReference}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <AlertTriangle
                              size={11}
                              className="text-amber-500"
                            />
                            {c.companyName}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {c.productRef} — {c.productName}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {fmt(c.qty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
