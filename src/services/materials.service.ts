import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { NotFoundError, AppError } from "@/lib/errors";
import {
  bulkImportMaterialsSchema,
  type MaterialImportRow,
  type ImportMaterialsResult,
} from "@/lib/import-schemas";

// ── Schemas ─────────────────────────────────────────────────────────────────

export const createMaterialSchema = z
  .object({
    reference: z
      .string()
      .trim()
      .min(2, "Referência obrigatória.")
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Use apenas letras, números, - ou _."),
    name: z.string().trim().min(2, "Nome obrigatório.").max(120),
    unit: z.string().trim().min(1, "Unidade obrigatória.").max(12),
    minStockQty: z.number().min(0, "Não pode ser negativo.").default(0),
    initialQty: z.number().min(0, "Não pode ser negativo.").default(0),
    tracksBatches: z.boolean().default(false),
  })
  .refine((v) => !v.tracksBatches || v.initialQty === 0, {
    message:
      "Materiais rastreáveis por lote começam sem stock — use 'Receber lote' a seguir para registar o primeiro.",
    path: ["initialQty"],
  });
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

export const updateMaterialSchema = z.object({
  materialId: z.string().trim().min(1, "Material obrigatório."),
  name: z.string().trim().min(2, "Nome obrigatório.").max(120),
  unit: z.string().trim().min(1, "Unidade obrigatória.").max(12),
  minStockQty: z.number().min(0, "Não pode ser negativo."),
  active: z.boolean(),
  tracksBatches: z.boolean(),
});
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;

export const receiveStockSchema = z.object({
  materialId: z.string().trim().min(1, "Material obrigatório."),
  qty: z.number().gt(0, "Quantidade deve ser maior que zero."),
  note: z.string().trim().max(200).optional(),
});
export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;

export const receiveMaterialBatchSchema = z.object({
  materialId: z.string().trim().min(1, "Material obrigatório."),
  batchCode: z.string().trim().min(1, "Código do lote obrigatório.").max(60),
  qty: z.number().gt(0, "Quantidade deve ser maior que zero."),
  supplierName: z.string().trim().max(120).optional(),
  certificateRef: z.string().trim().max(120).optional(),
  note: z.string().trim().max(200).optional(),
});
export type ReceiveMaterialBatchInput = z.infer<typeof receiveMaterialBatchSchema>;

export const adjustStockSchema = z.object({
  materialId: z.string().trim().min(1, "Material obrigatório."),
  newQty: z.number().min(0, "Não pode ser negativo."),
  note: z.string().trim().max(200).optional(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const setProductBomSchema = z.object({
  productId: z.string().trim().min(1, "Produto obrigatório."),
  items: z
    .array(
      z.object({
        materialId: z.string().trim().min(1, "Material obrigatório."),
        qtyPerUnit: z.number().gt(0, "Quantidade deve ser maior que zero."),
      }),
    )
    .max(50),
});
export type SetProductBomInput = z.infer<typeof setProductBomSchema>;

// ── Material CRUD ────────────────────────────────────────────────────────────

export async function createMaterial(input: CreateMaterialInput): Promise<void> {
  const existing = await prisma.material.findUnique({
    where: { reference: input.reference },
    select: { id: true },
  });
  if (existing) throw new AppError("Já existe um material com essa referência.");

  await prisma.$transaction(async (tx) => {
    const material = await tx.material.create({
      data: {
        reference: input.reference,
        name: input.name,
        unit: input.unit,
        minStockQty: input.minStockQty,
        stockQty: input.initialQty,
        tracksBatches: input.tracksBatches,
      },
    });
    if (input.initialQty > 0) {
      await tx.stockMovement.create({
        data: {
          materialId: material.id,
          delta: input.initialQty,
          reason: "receipt",
          note: "Stock inicial",
        },
      });
    }
  });
  invalidateCache(CACHE_TAGS.materials);
}

export async function updateMaterial(input: UpdateMaterialInput): Promise<void> {
  const material = await prisma.material.findUnique({
    where: { id: input.materialId },
    select: { id: true },
  });
  if (!material) throw new NotFoundError("Material não encontrado.");

  await prisma.material.update({
    where: { id: input.materialId },
    data: {
      name: input.name,
      unit: input.unit,
      minStockQty: input.minStockQty,
      active: input.active,
      tracksBatches: input.tracksBatches,
    },
  });
  invalidateCache(CACHE_TAGS.materials);
}

/** Adds stock (goods receipt) and logs the movement. Not for `tracksBatches`
 * materials — those must go through `receiveMaterialBatch` so the delivery's
 * heat/cast number and certificate are captured. */
export async function receiveStock(input: ReceiveStockInput): Promise<void> {
  const material = await prisma.material.findUnique({
    where: { id: input.materialId },
    select: { id: true, tracksBatches: true },
  });
  if (!material) throw new NotFoundError("Material não encontrado.");
  if (material.tracksBatches) {
    throw new AppError(
      "Este material é rastreável por lote — use 'Receber lote' para registar esta entrada.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.material.update({
      where: { id: input.materialId },
      data: { stockQty: { increment: input.qty } },
    });
    await tx.stockMovement.create({
      data: {
        materialId: input.materialId,
        delta: input.qty,
        reason: "receipt",
        note: input.note?.trim() || "Entrada de stock",
      },
    });
  });
  invalidateCache(CACHE_TAGS.materials);
}

/**
 * Receives a goods delivery of a `tracksBatches` material, creating the
 * `MaterialBatch` (with the supplier's heat/cast number and certificate
 * reference) that later work-order consumption will draw from FIFO. This is
 * the entry point of the whole traceability chain.
 */
export async function receiveMaterialBatch(input: ReceiveMaterialBatchInput): Promise<void> {
  const material = await prisma.material.findUnique({
    where: { id: input.materialId },
    select: { id: true, tracksBatches: true },
  });
  if (!material) throw new NotFoundError("Material não encontrado.");
  if (!material.tracksBatches) {
    throw new AppError(
      "Este material não está configurado para rastreio por lote. Use 'Entrada de stock'.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const batch = await tx.materialBatch.create({
      data: {
        materialId: input.materialId,
        batchCode: input.batchCode,
        supplierName: input.supplierName?.trim() || null,
        certificateRef: input.certificateRef?.trim() || null,
        receivedQty: input.qty,
        remainingQty: input.qty,
        note: input.note?.trim() || null,
      },
    });
    await tx.material.update({
      where: { id: input.materialId },
      data: { stockQty: { increment: input.qty } },
    });
    await tx.stockMovement.create({
      data: {
        materialId: input.materialId,
        delta: input.qty,
        reason: "receipt",
        materialBatchId: batch.id,
        note: input.note?.trim() || `Receção de lote ${input.batchCode}`,
      },
    });
  });
  invalidateCache(CACHE_TAGS.materials);
}

/** Corrects stock to an absolute value (inventory count) and logs the delta. */
export async function adjustStock(input: AdjustStockInput): Promise<void> {
  const material = await prisma.material.findUnique({
    where: { id: input.materialId },
    select: { id: true, stockQty: true },
  });
  if (!material) throw new NotFoundError("Material não encontrado.");

  const delta = input.newQty - material.stockQty;
  if (delta === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.material.update({
      where: { id: input.materialId },
      data: { stockQty: input.newQty },
    });
    await tx.stockMovement.create({
      data: {
        materialId: input.materialId,
        delta,
        reason: "adjustment",
        note: input.note?.trim() || "Acerto de inventário",
      },
    });
  });
  invalidateCache(CACHE_TAGS.materials);
}

// ── Bulk import (CSV) ────────────────────────────────────────────────────────

/**
 * Bulk-creates/updates materials from a client's spreadsheet export.
 * Existing materials (matched by `reference`) only have their master data
 * (name/unit/minStockQty) updated — stock quantities are never overwritten by
 * an import to avoid silently corrupting a count that already has movements
 * in the system; use "Entrada de stock" / "Acerto de inventário" for that.
 * New materials are created with `initialQty` as their starting stock, same
 * as the single-material creation flow.
 */
export async function importMaterials(
  rows: MaterialImportRow[],
): Promise<ImportMaterialsResult> {
  const data = bulkImportMaterialsSchema.parse(rows);

  const result: ImportMaterialsResult = { created: 0, updated: 0, errors: [] };
  const seenReferences = new Set<string>();

  const existing = await prisma.material.findMany({
    where: { reference: { in: data.map((r) => r.reference) } },
    select: { id: true, reference: true },
  });
  const existingByRef = new Map(existing.map((m) => [m.reference, m.id]));

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2; // +1 for header row, +1 for 1-based index
    if (seenReferences.has(row.reference)) {
      result.errors.push({
        row: rowNumber,
        reference: row.reference,
        message: "Referência duplicada dentro do ficheiro.",
      });
      continue;
    }
    seenReferences.add(row.reference);

    try {
      const existingId = existingByRef.get(row.reference);
      if (existingId) {
        await prisma.material.update({
          where: { id: existingId },
          data: { name: row.name, unit: row.unit, minStockQty: row.minStockQty },
        });
        result.updated++;
      } else {
        await prisma.$transaction(async (tx) => {
          const material = await tx.material.create({
            data: {
              reference: row.reference,
              name: row.name,
              unit: row.unit,
              minStockQty: row.minStockQty,
              stockQty: row.initialQty,
            },
          });
          if (row.initialQty > 0) {
            await tx.stockMovement.create({
              data: {
                materialId: material.id,
                delta: row.initialQty,
                reason: "receipt",
                note: "Importação CSV",
              },
            });
          }
        });
        result.created++;
      }
    } catch {
      result.errors.push({
        row: rowNumber,
        reference: row.reference,
        message: "Erro ao gravar esta linha.",
      });
    }
  }

  if (result.created > 0 || result.updated > 0) {
    invalidateCache(CACHE_TAGS.materials);
  }
  return result;
}

// ── Bill of materials ────────────────────────────────────────────────────────

/**
 * Replaces a product's bill of materials (delete + recreate in one
 * transaction). Only affects future work orders — existing ones keep their
 * snapshot.
 */
export async function setProductBom(input: SetProductBomInput): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true },
  });
  if (!product) throw new NotFoundError("Produto não encontrado.");

  const seen = new Set<string>();
  for (const it of input.items) {
    if (seen.has(it.materialId)) {
      throw new AppError("Material repetido na ficha técnica.");
    }
    seen.add(it.materialId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.bomItem.deleteMany({ where: { productId: input.productId } });
    if (input.items.length > 0) {
      await tx.bomItem.createMany({
        data: input.items.map((it) => ({
          productId: input.productId,
          materialId: it.materialId,
          qtyPerUnit: it.qtyPerUnit,
        })),
      });
    }
  });
  invalidateCache(CACHE_TAGS.materials);
}
