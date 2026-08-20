"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";

export type CsvImportField<F extends string> = {
  key: F;
  label: string;
  required: boolean;
};

type CsvColumnMappingProps<F extends string> = {
  headers: string[];
  fields: CsvImportField<F>[];
  /** Best-guess mapping from header aliasing, pre-fills the selects. */
  initialMapping: Partial<Record<F, number>>;
  onConfirm: (mapping: Partial<Record<F, number>>) => void;
  onCancel: () => void;
};

/**
 * Lets the user manually assign each of our model's fields to a column of
 * their own CSV/Excel export, for when the file's headers don't match any of
 * our known aliases (or the user simply wants to override the auto-guess).
 */
export function CsvColumnMapping<F extends string>({
  headers,
  fields,
  initialMapping,
  onConfirm,
  onCancel,
}: CsvColumnMappingProps<F>) {
  const [mapping, setMapping] = useState<Partial<Record<F, number>>>(initialMapping);

  const missingRequired = fields.filter(
    (f) => f.required && mapping[f.key] === undefined,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <AlertCircle size={16} />
        Não conseguimos identificar automaticamente todas as colunas. Escolha a
        que corresponde a cada campo.
      </div>

      <div className="space-y-2">
        {fields.map((field) => (
          <div
            key={field.key}
            className="grid grid-cols-2 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
          >
            <span className="text-sm text-slate-700">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </span>
            <select
              value={mapping[field.key] ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                setMapping((prev) => ({
                  ...prev,
                  [field.key]: value === "" ? undefined : Number(value),
                }));
              }}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            >
              <option value="">— não mapear —</option>
              {headers.map((h, idx) => (
                <option key={idx} value={idx}>
                  {h || `Coluna ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onConfirm(mapping)}
          disabled={missingRequired.length > 0}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Confirmar mapeamento
        </button>
      </div>
    </div>
  );
}
