import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { NotFoundError, AppError } from "@/lib/errors";
import { assertCompanyAccess, type SessionUser } from "@/lib/auth-guard";
import { isClientRole } from "@/lib/roles";
import { createWithReference } from "@/services/reference.service";
import { notifyAdmins } from "@/services/notifications.service";
import {
  bulkImportProductsSchema,
  type ProductImportRow,
  type ImportProductsResult,
} from "@/lib/import-schemas";

const companyPriceSchema = z.object({
  companyId: z.string().trim().min(1),
  unitPriceEur: z.coerce.number().nonnegative("Preço não pode ser negativo."),
});

export const productSchema = z.object({
  reference: z.string().trim().min(1, "Referência obrigatória.").max(60),
  name: z.string().trim().min(1, "Nome obrigatório.").max(120),
  description: z.string().trim().min(1, "Descrição obrigatória.").max(500),
  unit: z.string().trim().min(1, "Unidade obrigatória.").max(20),
  unitPriceEur: z.coerce.number().nonnegative("Preço não pode ser negativo."),
  category: z.string().trim().max(60).optional(),
  imageUrl: z
    .string()
    .trim()
    // Accept an http(s) URL (legacy) or an inline uploaded image (data URL).
    .max(900_000, "Imagem demasiado grande.")
    .refine(
      (v) =>
        v === "" ||
        /^https?:\/\//i.test(v) ||
        /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v),
      "Imagem inválida.",
    )
    .optional(),
  active: z.coerce.boolean().default(true),
  companyPrices: z.array(companyPriceSchema).default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

export const catalogOrderSchema = z.object({
  expectedDate: z.string().trim().min(1, "Data desejada obrigatória."),
  observations: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        quantity: z.coerce.number().positive("Quantidade deve ser maior que zero."),
      }),
    )
    .min(1, "Adicione pelo menos um produto ao carrinho."),
});

export type CatalogOrderInput = z.infer<typeof catalogOrderSchema>;

function normalizedProductData(data: ProductInput) {
  return {
    reference: data.reference,
    name: data.name,
    description: data.description,
    unit: data.unit,
    unitPriceEur: data.unitPriceEur,
    category: data.category?.trim() ? data.category.trim() : null,
    imageUrl: data.imageUrl?.trim() ? data.imageUrl.trim() : null,
    active: data.active,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export async function createProduct(data: ProductInput): Promise<string> {
  try {
    const product = await prisma.product.create({
      data: {
        ...normalizedProductData(data),
        prices: { create: data.companyPrices },
      },
    });
    invalidateCache(CACHE_TAGS.products);
    return product.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError("Já existe um produto com essa referência.");
    }
    throw err;
  }
}

export async function updateProduct(
  id: string,
  data: ProductInput,
): Promise<void> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Produto não encontrado.");

  try {
    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: normalizedProductData(data),
      }),
      prisma.productPrice.deleteMany({ where: { productId: id } }),
      prisma.productPrice.createMany({
        data: data.companyPrices.map((p) => ({ ...p, productId: id })),
      }),
    ]);
    invalidateCache(CACHE_TAGS.products);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError("Já existe um produto com essa referência.");
    }
    throw err;
  }
}

export async function setProductActive(
  id: string,
  active: boolean,
): Promise<void> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Produto não encontrado.");
  await prisma.product.update({ where: { id }, data: { active } });
  invalidateCache(CACHE_TAGS.products);
}

/**
 * Client self-service catalog order: the client picks active products and
 * quantities; the item reference/description/unit and the *effective* price
 * (per-company override falling back to the base price) are resolved
 * server-side — never trusted from the client. Creates a `pending` order for
 * the actor's company, mirroring the reorder flow, and notifies the factory.
 */
export async function orderFromCatalog(
  actor: SessionUser,
  data: CatalogOrderInput,
): Promise<string> {
  if (!isClientRole(actor.role) || !actor.companyId) {
    throw new AppError("Apenas clientes podem encomendar a partir do catálogo.");
  }
  const companyId = actor.companyId;
  assertCompanyAccess(actor, companyId);

  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
    include: { prices: { where: { companyId } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const items = data.items.map((line) => {
    const product = byId.get(line.productId);
    if (!product) {
      throw new NotFoundError("Produto indisponível no catálogo.");
    }
    const effectivePrice = product.prices[0]?.unitPriceEur ?? product.unitPriceEur;
    return {
      reference: product.reference,
      description: product.name,
      quantity: line.quantity,
      unit: product.unit,
      unitPriceEur: effectivePrice,
    };
  });

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  const order = await createWithReference("ENC", (reference) =>
    prisma.order.create({
      data: {
        reference,
        companyId,
        status: "pending",
        priority: "normal",
        batchNumber: null,
        createdDate: new Date(),
        expectedDate: new Date(data.expectedDate),
        observations: data.observations || undefined,
        items: { create: items },
      },
    }),
  );

  await notifyAdmins({
    type: "ORDER_CREATED",
    title: `Nova encomenda ${order.reference}`,
    body: `${company?.name ?? "Um cliente"} encomendou a partir do catálogo.`,
    href: `/admin/ordens/${order.id}`,
  });

  invalidateCache(CACHE_TAGS.orders);
  return order.id;
}

// ── Bulk import (CSV) ────────────────────────────────────────────────────────

/**
 * Bulk-creates/updates catalog products from a client's spreadsheet export.
 * Matched by `reference`: existing products have their base fields (name,
 * description, unit, price, category) updated in place — new products are
 * created active by default. Per-company price overrides and images stay
 * out of scope for the importer; those are edited one by one afterwards.
 */
export async function importProducts(
  rows: ProductImportRow[],
): Promise<ImportProductsResult> {
  const data = bulkImportProductsSchema.parse(rows);

  const result: ImportProductsResult = { created: 0, updated: 0, errors: [] };
  const seenReferences = new Set<string>();

  const existing = await prisma.product.findMany({
    where: { reference: { in: data.map((r) => r.reference) } },
    select: { id: true, reference: true },
  });
  const existingByRef = new Map(existing.map((p) => [p.reference, p.id]));

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

    const description = row.description.trim() || row.name;
    const category = row.category.trim() ? row.category.trim() : null;

    try {
      const existingId = existingByRef.get(row.reference);
      if (existingId) {
        await prisma.product.update({
          where: { id: existingId },
          data: {
            name: row.name,
            description,
            unit: row.unit,
            unitPriceEur: row.unitPriceEur,
            category,
          },
        });
        result.updated++;
      } else {
        await prisma.product.create({
          data: {
            reference: row.reference,
            name: row.name,
            description,
            unit: row.unit,
            unitPriceEur: row.unitPriceEur,
            category,
            active: true,
          },
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
    invalidateCache(CACHE_TAGS.products);
  }
  return result;
}
