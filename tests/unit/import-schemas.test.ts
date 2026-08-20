import { describe, it, expect } from "vitest";
import { parseMaterialsCsv } from "@/lib/import-schemas";

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
});
