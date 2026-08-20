import { z } from "zod";
import Papa from "papaparse";

/**
 * Row schema for bulk-importing materials from a CSV export (e.g. a client's
 * existing Excel spreadsheet). Kept in its own module (no Prisma import) so
 * it can be safely used from both the client component that previews the
 * parsed rows and the server-side service that persists them.
 */
export const materialImportRowSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(2, "Referência obrigatória (mín. 2 caracteres).")
    .max(40, "Referência demasiado longa (máx. 40 caracteres).")
    .regex(/^[A-Za-z0-9_-]+$/, "Use apenas letras, números, - ou _."),
  name: z.string().trim().min(2, "Nome obrigatório.").max(120),
  unit: z.string().trim().min(1, "Unidade obrigatória.").max(12),
  minStockQty: z.coerce
    .number()
    .min(0, "Stock mínimo deve ser um número igual ou maior que 0.")
    .default(0),
  initialQty: z.coerce
    .number()
    .min(0, "Stock inicial deve ser um número igual ou maior que 0.")
    .default(0),
});
export type MaterialImportRow = z.infer<typeof materialImportRowSchema>;

export const bulkImportMaterialsSchema = z
  .array(materialImportRowSchema)
  .min(1, "O ficheiro não tem nenhuma linha válida.")
  .max(1000, "Máximo de 1000 linhas por importação.");

export type ImportMaterialsResult = {
  created: number;
  updated: number;
  errors: { row: number; reference?: string; message: string }[];
};

/** Header aliases (lowercase, accents-stripped) accepted for each CSV column. */
export const MATERIAL_IMPORT_HEADER_ALIASES: Record<
  keyof MaterialImportRow,
  string[]
> = {
  reference: ["referencia", "reference", "ref", "codigo"],
  name: ["nome", "name", "designacao", "descricao"],
  unit: ["unidade", "unit", "un"],
  minStockQty: ["stock_minimo", "stockminimo", "minstockqty", "stock_min"],
  initialQty: ["stock_inicial", "stockinicial", "initialqty", "stock_atual", "stockatual"],
};

export const MATERIAL_IMPORT_TEMPLATE_CSV =
  "referencia,nome,unidade,stock_minimo,stock_inicial\n" +
  "MAT-001,Chapa de aço inox 2mm,kg,50,120\n" +
  "MAT-002,Varão de alumínio 10mm,m,20,0\n";

function stripAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Maps arbitrary CSV header names (accents/case-insensitive, with known
 * aliases) to the canonical `MaterialImportRow` keys used by the schema.
 * Columns that don't match any known alias are ignored.
 */
export function mapMaterialCsvHeaders(
  headers: string[],
): Partial<Record<keyof MaterialImportRow, number>> {
  const mapping: Partial<Record<keyof MaterialImportRow, number>> = {};
  const normalized = headers.map(stripAccents);

  (Object.keys(MATERIAL_IMPORT_HEADER_ALIASES) as (keyof MaterialImportRow)[]).forEach(
    (field) => {
      const aliases = MATERIAL_IMPORT_HEADER_ALIASES[field];
      const idx = normalized.findIndex((h) => aliases.includes(h));
      if (idx !== -1) mapping[field] = idx;
    },
  );

  return mapping;
}

export type MaterialCsvRowResult =
  | { row: number; ok: true; data: MaterialImportRow }
  | { row: number; ok: false; reference?: string; message: string };

/**
 * Parses a raw CSV string (auto-detects `,` or `;` delimiter, common in
 * Portuguese Excel exports) into validated material rows. Pure/no I/O so it
 * can run both in the browser (import preview) and, if ever needed, on the
 * server — it has no Prisma dependency.
 */
export function parseMaterialsCsv(text: string): {
  headers: string[];
  unmappedFields: (keyof MaterialImportRow)[];
  results: MaterialCsvRowResult[];
} {
  const parsed = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: true,
  });
  const rows = parsed.data;
  const headers = rows[0] ?? [];
  const mapping = mapMaterialCsvHeaders(headers);
  const requiredFields: (keyof MaterialImportRow)[] = ["reference", "name", "unit"];
  const unmappedFields = requiredFields.filter((field) => mapping[field] === undefined);

  const results: MaterialCsvRowResult[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const raw: Record<string, string> = {};
    (Object.keys(mapping) as (keyof MaterialImportRow)[]).forEach((field) => {
      const idx = mapping[field];
      if (idx !== undefined) raw[field] = (cols[idx] ?? "").trim();
    });

    const parsedRow = materialImportRowSchema.safeParse(raw);
    if (parsedRow.success) {
      results.push({ row: i + 1, ok: true, data: parsedRow.data });
    } else {
      results.push({
        row: i + 1,
        ok: false,
        reference: raw.reference,
        message: parsedRow.error.issues[0]?.message ?? "Linha inválida.",
      });
    }
  }

  return { headers, unmappedFields, results };
}
