"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  X,
  FileDown,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import {
  parseMaterialsCsv,
  MATERIAL_IMPORT_TEMPLATE_CSV,
  type MaterialCsvRowResult,
} from "@/lib/import-schemas";
import { actionError } from "@/lib/action-result";
import { importMaterials } from "@/actions/materials";

/**
 * Lets an admin bulk-create/update materials from a CSV export of the
 * client's existing spreadsheet — the biggest onboarding friction point when
 * migrating a factory off Excel.
 */
export function MaterialsImportModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{
    unmappedFields: string[];
    results: MaterialCsvRowResult[];
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
    try {
      const { unmappedFields, results } = parseMaterialsCsv(text);
      if (unmappedFields.length > 0) {
        setError(
          `Não foi possível identificar as colunas: ${unmappedFields.join(", ")}. ` +
            "Confirme os cabeçalhos ou use o modelo disponibilizado.",
        );
        setParsed(null);
        return;
      }
      if (results.length === 0) {
        setError("O ficheiro não tem nenhuma linha de dados.");
        setParsed(null);
        return;
      }
      setParsed({ unmappedFields, results });
    } catch {
      setError("Não foi possível ler este ficheiro como CSV.");
      setParsed(null);
    }
  };

  const validRows = (parsed?.results.filter((r) => r.ok) ?? []) as Extract<
    MaterialCsvRowResult,
    { ok: true }
  >[];
  const invalidRows = parsed?.results.filter((r) => !r.ok) ?? [];

  const confirmImport = () => {
    if (validRows.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await importMaterials(validRows.map((r) => r.data));
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          return;
        }
        setSummary(
          res as {
            created: number;
            updated: number;
            errors: { row: number; reference?: string; message: string }[];
          },
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([MATERIAL_IMPORT_TEMPLATE_CSV], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importacao-materiais.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Upload size={16} /> Importar CSV
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Importar materiais de CSV"
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h2 className="font-semibold text-slate-800">
                  Importar materiais de CSV
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Traga a sua lista de materiais (ex. exportada do Excel) para
                  criar ou atualizar registos em massa.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!summary && (
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

              {parsed && !summary && (
                <>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 size={15} /> {validRows.length} linhas válidas
                    </span>
                    {invalidRows.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-amber-700">
                        <AlertTriangle size={15} /> {invalidRows.length} linhas com erro (serão ignoradas)
                      </span>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2">Linha</th>
                          <th className="text-left px-3 py-2">Referência</th>
                          <th className="text-left px-3 py-2">Nome</th>
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
                      <Upload size={16} /> Importar {validRows.length} materiais
                    </button>
                  </div>
                </>
              )}

              {summary && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <CheckCircle2 size={16} />
                    {summary.created} materiais criados, {summary.updated} atualizados.
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
          </div>
        </div>
      )}
    </>
  );
}
