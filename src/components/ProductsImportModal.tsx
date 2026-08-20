"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileDown,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import {
  parseProductsCsv,
  parseProductsCsvWithMapping,
  PRODUCT_IMPORT_TEMPLATE_CSV,
  PRODUCT_IMPORT_FIELDS,
  type ProductImportRow,
  type ProductCsvRowResult,
} from "@/lib/import-schemas";
import { importProducts } from "@/actions/products";
import { CsvColumnMapping } from "@/components/CsvColumnMapping";
import { Modal } from "@/components/ui/Modal";

/**
 * Lets an admin bulk-create/update catalog products from a CSV export of the
 * client's existing price list — mirrors MaterialsImportModal for the
 * armazém module, applied to the produtos/catálogo module.
 */
export function ProductsImportModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [mappingStep, setMappingStep] = useState<{
    headers: string[];
    autoMapping: Partial<Record<keyof ProductImportRow, number>>;
  } | null>(null);
  const [parsed, setParsed] = useState<{
    results: ProductCsvRowResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    created: number;
    updated: number;
    errors: { row: number; reference?: string; message: string }[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(null);
    setCsvText(null);
    setMappingStep(null);
    setParsed(null);
    setError(null);
    setSummary(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const handleFile = async (file: File) => {
    setError(null);
    setSummary(null);
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    try {
      const { unmappedFields, results, headers, autoMapping } = parseProductsCsv(text);
      if (unmappedFields.length > 0) {
        setMappingStep({ headers, autoMapping });
        setParsed(null);
        return;
      }
      if (results.length === 0) {
        setError("O ficheiro não tem nenhuma linha de dados.");
        setParsed(null);
        return;
      }
      setParsed({ results });
    } catch {
      setError("Não foi possível ler este ficheiro como CSV.");
      setParsed(null);
    }
  };

  const confirmMapping = (mapping: Partial<Record<keyof ProductImportRow, number>>) => {
    if (!csvText) return;
    const results = parseProductsCsvWithMapping(csvText, mapping);
    if (results.length === 0) {
      setError("O ficheiro não tem nenhuma linha de dados.");
      setMappingStep(null);
      return;
    }
    setMappingStep(null);
    setParsed({ results });
  };

  const validRows = (parsed?.results.filter((r) => r.ok) ?? []) as Extract<
    ProductCsvRowResult,
    { ok: true }
  >[];
  const invalidRows = parsed?.results.filter((r) => !r.ok) ?? [];

  const confirmImport = () => {
    if (validRows.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await importProducts(validRows.map((r) => r.data));
        setSummary(res);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([PRODUCT_IMPORT_TEMPLATE_CSV], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importacao-produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
      >
        <Upload size={16} /> Importar CSV
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Importar produtos de CSV"
        description="Traga a sua lista de preços (ex. exportada do Excel) para criar ou atualizar produtos do catálogo em massa."
        maxWidth="3xl"
        scrollable
      >
        <div className="p-5 space-y-4">
          {!summary && !parsed && !mappingStep && (
            <>
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                <FileDown size={15} /> Descarregar modelo CSV
              </button>

              <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  <Upload size={16} /> Escolher ficheiro CSV
                </button>
                {fileName && (
                  <p className="text-xs text-slate-500 mt-2">{fileName}</p>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {mappingStep && !summary && (
            <CsvColumnMapping
              headers={mappingStep.headers}
              fields={PRODUCT_IMPORT_FIELDS}
              initialMapping={mappingStep.autoMapping}
              onConfirm={confirmMapping}
              onCancel={reset}
            />
          )}

          {parsed && !summary && (
            <>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 size={15} /> {validRows.length} linhas válidas
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-amber-700">
                      <AlertTriangle size={15} /> {invalidRows.length} linhas com erro (serão ignoradas)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const { headers, autoMapping } = parseProductsCsv(csvText ?? "");
                    setMappingStep({ headers, autoMapping });
                    setParsed(null);
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
                >
                  Ajustar mapeamento de colunas
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Linha</th>
                      <th className="text-left px-3 py-2">Referência</th>
                      <th className="text-left px-3 py-2">Nome</th>
                      <th className="text-left px-3 py-2">Preço</th>
                      <th className="text-left px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.results.map((r) => (
                      <tr key={r.row} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-500">{r.row}</td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {r.ok ? r.data.reference : r.reference || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {r.ok ? r.data.name : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {r.ok ? `${r.data.unitPriceEur.toFixed(2)} €` : "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          {r.ok ? (
                            <span className="text-emerald-600">OK</span>
                          ) : (
                            <span className="text-red-600">{r.message}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={pending || validRows.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  <Upload size={16} /> Importar {validRows.length} produtos
                </button>
              </div>
            </>
          )}

          {summary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 size={16} />
                {summary.created} produtos criados, {summary.updated} atualizados.
              </div>
              {summary.errors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <p className="font-medium mb-1">
                    {summary.errors.length} linhas não foram importadas:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {summary.errors.map((e) => (
                      <li key={e.row}>
                        Linha {e.row} ({e.reference ?? "—"}): {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
