"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea, requireClient } from "@/lib/auth-guard";
import {
  createProduct as createProductService,
  updateProduct as updateProductService,
  setProductActive as setProductActiveService,
  orderFromCatalog as orderFromCatalogService,
  productSchema,
  catalogOrderSchema,
  type ProductInput,
  type CatalogOrderInput,
} from "@/services/products.service";

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

  await updateProductService(id, data);

  revalidatePath("/admin/produtos");
  revalidatePath("/dashboard/catalogo");
}

export async function setProductActive(id: string, active: boolean) {
  await requireAdminArea("armazem");

  await setProductActiveService(id, active);

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
