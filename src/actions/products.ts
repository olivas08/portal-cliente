"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea, requireClient } from "@/lib/auth-guard";
import { idSchema, booleanSchema } from "@/lib/schemas";
import { guardAction } from "@/lib/errors";
import {
  createProduct as createProductService,
  updateProduct as updateProductService,
  setProductActive as setProductActiveService,
  orderFromCatalog as orderFromCatalogService,
  importProducts as importProductsService,
  productSchema,
  catalogOrderSchema,
  type ProductInput,
  type CatalogOrderInput,
} from "@/services/products.service";
import {
  bulkImportProductsSchema,
  type ProductImportRow,
} from "@/lib/import-schemas";

export async function createProduct(input: ProductInput) {
  await requireAdminArea("armazem");
  const data = productSchema.parse(input);

  const id = await createProductService(data);

  revalidatePath("/admin/produtos");
  revalidatePath("/dashboard/catalogo");
  return id;
}

export async function updateProduct(id: string, input: ProductInput) {
  await requireAdminArea("armazem");
  const data = productSchema.parse(input);

  await updateProductService(idSchema.parse(id), data);

  revalidatePath("/admin/produtos");
  revalidatePath("/dashboard/catalogo");
}

export async function setProductActive(id: string, active: boolean) {
  await requireAdminArea("armazem");

  await setProductActiveService(idSchema.parse(id), booleanSchema.parse(active));

  revalidatePath("/admin/produtos");
  revalidatePath("/dashboard/catalogo");
}

export async function placeCatalogOrder(input: CatalogOrderInput) {
  const actor = await requireClient();
  const data = catalogOrderSchema.parse(input);

  const id = await orderFromCatalogService(actor, data);

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return id;
}

/** Bulk import of catalog products from a parsed/validated CSV (see ProductsImportModal). */
export async function importProducts(input: ProductImportRow[]) {
  return guardAction(async () => {
    await requireAdminArea("armazem");
    const data = bulkImportProductsSchema.parse(input);
    const result = await importProductsService(data);

    revalidatePath("/admin/produtos");
    revalidatePath("/dashboard/catalogo");
    return result;
  });
}
