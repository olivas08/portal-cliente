"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { idSchema } from "@/lib/schemas";
import {
  uploadOrderDocumentForUser,
  deleteOrderDocumentForUser,
  getOrderDocumentDownloadUrlForUser,
} from "@/services/documents.service";

export async function uploadOrderDocument(orderId: string, formData: FormData) {
  const user = await requireUser();
  const parsedId = idSchema.parse(orderId);
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Selecione um ficheiro para enviar.");
  }
  await uploadOrderDocumentForUser(user, parsedId, file);
  revalidatePath(`/admin/ordens/${parsedId}`);
  revalidatePath(`/dashboard/ordens/${parsedId}`);
}

export async function deleteOrderDocument(documentId: string) {
  const user = await requireUser();
  const parsedId = idSchema.parse(documentId);
  const orderId = await deleteOrderDocumentForUser(user, parsedId);
  revalidatePath(`/admin/ordens/${orderId}`);
  revalidatePath(`/dashboard/ordens/${orderId}`);
}

export async function getOrderDocumentDownloadUrl(documentId: string) {
  const user = await requireUser();
  return getOrderDocumentDownloadUrlForUser(user, idSchema.parse(documentId));
}
