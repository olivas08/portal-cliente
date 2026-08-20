import { describe, it, expect } from "vitest";
import {
  parseMaterialsCsv,
  parseMaterialsCsvWithMapping,
  parseProductsCsv,
  parseProductsCsvWithMapping,
} from "@/lib/import-schemas";

describe("parseMaterialsCsv", () => {
  it("parses a well-formed CSV with Portuguese headers", () => {
    const csv =
      "referencia,nome,unidade,stock_minimo,stock_inicial\n" +
      "MAT-001,Chapa de aço inox 2mm,kg,50,120\n" +
      "MAT-002,Varão de alumínio 10mm,m,20,0\n";

    const { unmappedFields, results } = parseMaterialsCsv(csv);

    expect(unmappedFields).toEqual([]);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      row: 2,
      ok: true,
      data: {
        reference: "MAT-001",
        name: "Chapa de aço inox 2mm",
        unit: "kg",
        minStockQty: 50,
        initialQty: 120,
      },
    });
  });

  it("accepts header aliases in different case/order", () => {
    const csv = "Nome,Ref,Unidade\nChapa,MAT-010,kg\n";
    const { unmappedFields, results } = parseMaterialsCsv(csv);
    expect(unmappedFields).toEqual([]);
    expect(results[0]).toMatchObject({
      ok: true,
      data: { reference: "MAT-010", name: "Chapa", unit: "kg" },
    });
  });

  it("defaults stock fields to 0 when the columns are absent", () => {
    const csv = "referencia,nome,unidade\nMAT-020,Perfil,un\n";
    const { results } = parseMaterialsCsv(csv);
    expect(results[0]).toMatchObject({
      ok: true,
      data: { minStockQty: 0, initialQty: 0 },
    });
  });

  it("reports required columns that could not be matched", () => {
    const csv = "codigo,descricao\nMAT-001,Chapa\n";
    const { unmappedFields } = parseMaterialsCsv(csv);
    expect(unmappedFields).toEqual(["unit"]);
  });

  it("flags a row with an invalid reference as an error, not a valid row", () => {
    const csv = "referencia,nome,unidade\n a b,Chapa,kg\n";
    const { results } = parseMaterialsCsv(csv);
    expect(results[0].ok).toBe(false);
    if (!results[0].ok) {
      expect(results[0].message).toMatch(/letras, números/i);
    }
  });

  it("flags a row with a negative stock quantity as an error", () => {
    const csv = "referencia,nome,unidade,stock_minimo\nMAT-030,Chapa,kg,-5\n";
    const { results } = parseMaterialsCsv(csv);
    expect(results[0].ok).toBe(false);
  });

  it("supports semicolon-delimited CSV (common PT Excel export)", () => {
    const csv = "referencia;nome;unidade\nMAT-040;Chapa;kg\n";
    const { unmappedFields, results } = parseMaterialsCsv(csv);
    expect(unmappedFields).toEqual([]);
    expect(results[0]).toMatchObject({ ok: true, data: { reference: "MAT-040" } });
  });

  it("exposes raw headers and the auto-detected mapping for the mapping UI", () => {
    const csv = "codigo,descricao,un\nMAT-050,Chapa,kg\n";
    const { headers, autoMapping, unmappedFields } = parseMaterialsCsv(csv);
    expect(headers).toEqual(["codigo", "descricao", "un"]);
    expect(autoMapping).toMatchObject({ reference: 0, name: 1, unit: 2 });
    expect(unmappedFields).toEqual([]);
  });

  it("re-parses using a manually chosen column mapping when headers don't match any alias", () => {
    // Headers here ("coluna1", "coluna2", "coluna3") don't match any known alias.
    const csv = "coluna1,coluna2,coluna3\nMAT-060,Chapa especial,kg\n";
    const { unmappedFields } = parseMaterialsCsv(csv);
    expect(unmappedFields).toEqual(["reference", "name", "unit"]);

    const results = parseMaterialsCsvWithMapping(csv, {
      reference: 0,
      name: 1,
      unit: 2,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      ok: true,
      data: { reference: "MAT-060", name: "Chapa especial", unit: "kg" },
    });
  });
});

describe("parseProductsCsv", () => {
  it("parses a well-formed CSV with Portuguese headers", () => {
    const csv =
      "referencia,nome,descricao,unidade,preco_unitario,categoria\n" +
      "PROD-001,Reservatório inox 500L,Vertical em aço 304,un,850.00,Reservatórios\n";
    const { unmappedFields, results } = parseProductsCsv(csv);
    expect(unmappedFields).toEqual([]);
    expect(results[0]).toMatchObject({
      ok: true,
      data: {
        reference: "PROD-001",
        name: "Reservatório inox 500L",
        description: "Vertical em aço 304",
        unit: "un",
        unitPriceEur: 850,
        category: "Reservatórios",
      },
    });
  });

  it("defaults description and category to empty string when absent", () => {
    const csv = "referencia,nome,unidade,preco_unitario\nPROD-010,Perfil,un,10\n";
    const { unmappedFields, results } = parseProductsCsv(csv);
    expect(unmappedFields).toEqual([]);
    expect(results[0]).toMatchObject({
      ok: true,
      data: { description: "", category: "" },
    });
  });

  it("reports missing required columns (price is required for products)", () => {
    const csv = "referencia,nome,unidade\nPROD-020,Perfil,un\n";
    const { unmappedFields } = parseProductsCsv(csv);
    expect(unmappedFields).toEqual(["unitPriceEur"]);
  });

  it("flags a negative price as an invalid row", () => {
    const csv = "referencia,nome,unidade,preco_unitario\nPROD-030,Perfil,un,-5\n";
    const { results } = parseProductsCsv(csv);
    expect(results[0].ok).toBe(false);
  });

  it("accepts price header aliases (preco, price, pvp)", () => {
    const csv = "ref,nome,unidade,pvp\nPROD-040,Perfil,un,25.5\n";
    const { unmappedFields, results } = parseProductsCsv(csv);
    expect(unmappedFields).toEqual([]);
    expect(results[0]).toMatchObject({ ok: true, data: { unitPriceEur: 25.5 } });
  });

  it("re-parses using a manually chosen column mapping when headers don't match any alias", () => {
    const csv = "colA,colB,colC,colD\nPROD-050,Componente especial,un,99.9\n";
    const { unmappedFields } = parseProductsCsv(csv);
    expect(unmappedFields).toEqual(["reference", "name", "unit", "unitPriceEur"]);

    const results = parseProductsCsvWithMapping(csv, {
      reference: 0,
      name: 1,
      unit: 2,
      unitPriceEur: 3,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      ok: true,
      data: { reference: "PROD-050", name: "Componente especial", unit: "un", unitPriceEur: 99.9 },
    });
  });
});
