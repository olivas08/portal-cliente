"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import {
  createMaterial as createMaterialService,
  updateMaterial as updateMaterialService,
  receiveStock as receiveStockService,
  adjustStock as adjustStockService,
  setProductBom as setProductBomService,
  createMaterialSchema,
  updateMaterialSchema,
  receiveStockSchema,
  adjustStockSchema,
  setProductBomSchema,
  type CreateMaterialInput,
  type UpdateMaterialInput,
  type ReceiveStockInput,
  type AdjustStockInput,
  type SetProductBomInput,
} from "@/services/materials.service";

const ADMIN_WAREHOUSE = "/admin/armazem";
const ADMIN_BOM = "/admin/armazem/fichas-tecnicas";
const ADMIN_BOARD = "/admin/producao";

export async function createMaterial(input: CreateMaterialInput) {
  await requireAdmin();
  const data = createMaterialSchema.parse(input);
  await createMaterialService(data);
  revalidatePath(ADMIN_WAREHOUSE);
}

export async function updateMaterial(input: UpdateMaterialInput) {
  await requireAdmin();
  const data = updateMaterialSchema.parse(input);
  await updateMaterialService(data);
  revalidatePath(ADMIN_WAREHOUSE);
}

export async function receiveStock(input: ReceiveStockInput) {
  await requireAdmin();
  const data = receiveStockSchema.parse(input);
  await receiveStockService(data);
  revalidatePath(ADMIN_WAREHOUSE);
}

export async function adjustStock(input: AdjustStockInput) {
  await requireAdmin();
  const data = adjustStockSchema.parse(input);
  await adjustStockService(data);
  revalidatePath(ADMIN_WAREHOUSE);
}

export async function setProductBom(input: SetProductBomInput) {
  await requireAdmin();
  const data = setProductBomSchema.parse(input);
  await setProductBomService(data);
  revalidatePath(ADMIN_BOM);
  revalidatePath(ADMIN_BOARD);
}
