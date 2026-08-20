import { z } from "zod";
import Papa from "papaparse";

/**
 * Generic result of validating one parsed CSV row against a zod schema.
 * Shared by every entity's CSV importer (materials, products, ...).
 */
export type CsvRowResult<T> =
  | { row: number; ok: true; data: T }
  | { row: number; ok: false; reference?: string; message: string };

function stripAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Maps arbitrary CSV header names (accents/case-insensitive, with known
 * aliases) to the canonical field keys used by a row schema. Columns that
 * don't match any known alias are ignored.
 */
function mapCsvHeaders<F extends string>(
  headers: string[],
  headerAliases: Record<F, string[]>,
): Partial<Record<F, number>> {
  const mapping: Partial<Record<F, number>> = {};
  const normalized = headers.map(stripAccents);

  (Object.keys(headerAliases) as F[]).forEach((field) => {
    const aliases = headerAliases[field];
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) mapping[field] = idx;
  });

  return mapping;
}

/**
 * Parses a raw CSV string (auto-detects `,` or `;` delimiter, common in
 * Portuguese Excel exports) into rows validated against `schema`. Pure/no I/O
 * so it can run both in the browser (import preview) and, if ever needed, on
 * the server — it has no Prisma dependency.
 */
function parseCsvRows<F extends string, T>(
  text: string,
  headerAliases: Record<F, string[]>,
  requiredFields: F[],
  schema: z.ZodType<T>,
): { unmappedFields: F[]; results: CsvRowResult<T>[] } {
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const rows = parsed.data;
  const headers = rows[0] ?? [];
  const mapping = mapCsvHeaders(headers, headerAliases);
  const unmappedFields = requiredFields.filter((field) => mapping[field] === undefined);

  const results: CsvRowResult<T>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const raw: Record<string, string> = {};
    (Object.keys(mapping) as F[]).forEach((field) => {
      const idx = mapping[field];
      if (idx !== undefined) raw[field] = (cols[idx] ?? "").trim();
    });

    const parsedRow = schema.safeParse(raw);
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

  return { unmappedFields, results };
}

// ── Materials ────────────────────────────────────────────────────────────────

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

export type MaterialCsvRowResult = CsvRowResult<MaterialImportRow>;

const MATERIAL_REQUIRED_FIELDS: (keyof MaterialImportRow)[] = [
  "reference",
  "name",
  "unit",
];

export function parseMaterialsCsv(text: string): {
  unmappedFields: (keyof MaterialImportRow)[];
  results: MaterialCsvRowResult[];
} {
  return parseCsvRows(
    text,
    MATERIAL_IMPORT_HEADER_ALIASES,
    MATERIAL_REQUIRED_FIELDS,
    materialImportRowSchema,
  );
}

// ── Products ─────────────────────────────────────────────────────────────────

/**
 * Row schema for bulk-importing catalog products from a CSV export. Fields
 * that need more care than a spreadsheet column can express (image, per-
 * client price overrides) are intentionally left out of the importer —
 * those stay editable one by one in the product form.
 */
export const productImportRowSchema = z.object({
  reference: z.string().trim().min(1, "Referência obrigatória.").max(60),
  name: z.string().trim().min(1, "Nome obrigatório.").max(120),
  description: z.string().trim().max(500).default(""),
  unit: z.string().trim().min(1, "Unidade obrigatória.").max(20),
  unitPriceEur: z.coerce.number().nonnegative("Preço não pode ser negativo."),
  category: z.string().trim().max(60).default(""),
});
export type ProductImportRow = z.infer<typeof productImportRowSchema>;

export const bulkImportProductsSchema = z
  .array(productImportRowSchema)
  .min(1, "O ficheiro não tem nenhuma linha válida.")
  .max(1000, "Máximo de 1000 linhas por importação.");

export type ImportProductsResult = {
  created: number;
  updated: number;
  errors: { row: number; reference?: string; message: string }[];
};

export const PRODUCT_IMPORT_HEADER_ALIASES: Record<
  keyof ProductImportRow,
  string[]
> = {
  reference: ["referencia", "reference", "ref", "codigo"],
  name: ["nome", "name", "designacao"],
  description: ["descricao", "description", "desc"],
  unit: ["unidade", "unit", "un"],
  unitPriceEur: ["preco", "preco_unitario", "unitpriceeur", "price", "preco_eur", "pvp"],
  category: ["categoria", "category", "familia"],
};

export const PRODUCT_IMPORT_TEMPLATE_CSV =
  "referencia,nome,descricao,unidade,preco_unitario,categoria\n" +
  "PROD-001,Reservatório inox 500L,Reservatório vertical em aço inox 304,un,850.00,Reservatórios\n" +
  "PROD-002,Tubo inox 2 polegadas,Tubo sem costura schedule 10,m,12.50,Tubagens\n";

export type ProductCsvRowResult = CsvRowResult<ProductImportRow>;

const PRODUCT_REQUIRED_FIELDS: (keyof ProductImportRow)[] = [
  "reference",
  "name",
  "unit",
  "unitPriceEur",
];

export function parseProductsCsv(text: string): {
  unmappedFields: (keyof ProductImportRow)[];
  results: ProductCsvRowResult[];
} {
  return parseCsvRows(
    text,
    PRODUCT_IMPORT_HEADER_ALIASES,
    PRODUCT_REQUIRED_FIELDS,
    productImportRowSchema,
  );
}
