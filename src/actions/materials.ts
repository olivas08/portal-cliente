"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/auth-guard";
import { guardAction } from "@/lib/errors";
import {
  createMaterial as createMaterialService,
  updateMaterial as updateMaterialService,
  receiveStock as receiveStockService,
  receiveMaterialBatch as receiveMaterialBatchService,
  adjustStock as adjustStockService,
  setProductBom as setProductBomService,
  importMaterials as importMaterialsService,
  createMaterialSchema,
  updateMaterialSchema,
  receiveStockSchema,
  receiveMaterialBatchSchema,
  adjustStockSchema,
  setProductBomSchema,
  type CreateMaterialInput,
  type UpdateMaterialInput,
  type ReceiveStockInput,
  type ReceiveMaterialBatchInput,
  type AdjustStockInput,
  type SetProductBomInput,
} from "@/services/materials.service";
import { getMaterialBatches, findBatchTrace } from "@/lib/data";
import {
  bulkImportMaterialsSchema,
  type MaterialImportRow,
} from "@/lib/import-schemas";

const ADMIN_WAREHOUSE = "/admin/armazem";
const ADMIN_BOM = "/admin/armazem/fichas-tecnicas";
const ADMIN_BOARD = "/admin/producao";

export async function createMaterial(input: CreateMaterialInput) {
  return guardAction(async () => {
    await requireAdminArea("armazem");
    const data = createMaterialSchema.parse(input);
    await createMaterialService(data);
    revalidatePath(ADMIN_WAREHOUSE);
  });
}

export async function updateMaterial(input: UpdateMaterialInput) {
  return guardAction(async () => {
    await requireAdminArea("armazem");
    const data = updateMaterialSchema.parse(input);
    await updateMaterialService(data);
    revalidatePath(ADMIN_WAREHOUSE);
  });
}

export async function receiveStock(input: ReceiveStockInput) {
  return guardAction(async () => {
    await requireAdminArea("armazem");
    const data = receiveStockSchema.parse(input);
    await receiveStockService(data);
    revalidatePath(ADMIN_WAREHOUSE);
  });
}

export async function receiveMaterialBatch(input: ReceiveMaterialBatchInput) {
  return guardAction(async () => {
    await requireAdminArea("armazem");
    const data = receiveMaterialBatchSchema.parse(input);
    await receiveMaterialBatchService(data);
    revalidatePath(ADMIN_WAREHOUSE);
  });
}

/** On-demand batch history for one material, used by the warehouse table's
 * expandable "lotes" row (fetched only when the admin actually opens it). */
export async function getMaterialBatchesAction(materialId: string) {
  await requireAdminArea("armazem");
  return getMaterialBatches(materialId);
}

/** Recall search: given a batch/heat code, find every order it was consumed
 * into, across all clients. */
export async function findBatchTraceAction(batchCode: string) {
  await requireAdminArea("armazem");
  return findBatchTrace(batchCode);
}

export async function adjustStock(input: AdjustStockInput) {
  return guardAction(async () => {
    await requireAdminArea("armazem");
    const data = adjustStockSchema.parse(input);
    await adjustStockService(data);
    revalidatePath(ADMIN_WAREHOUSE);
  });
}

export async function setProductBom(input: SetProductBomInput) {
  return guardAction(async () => {
    await requireAdminArea("armazem");
    const data = setProductBomSchema.parse(input);
    await setProductBomService(data);
    revalidatePath(ADMIN_BOM);
    revalidatePath(ADMIN_BOARD);
  });
}

/** Bulk import of materials from a parsed/validated CSV (see MaterialsImportModal). */
export async function importMaterials(input: MaterialImportRow[]) {
  return guardAction(async () => {
    await requireAdminArea("armazem");
    const data = bulkImportMaterialsSchema.parse(input);
    const result = await importMaterialsService(data);
    revalidatePath(ADMIN_WAREHOUSE);
    return result;
  });
}
