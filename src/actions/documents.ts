"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  uploadDocumentFile,
  deleteDocumentFile,
  getDocumentDownloadUrl,
} from "@/lib/storage";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

async function requireOrderAccess(orderId: string) {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error("Não autorizado.");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Encomenda não encontrada.");
  if (user.role !== "ADMIN" && order.companyId !== user.companyId) {
    throw new Error("Não autorizado.");
  }
  return { user, order };
}

export async function uploadOrderDocument(orderId: string, formData: FormData) {
  const { user } = await requireOrderAccess(orderId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um ficheiro para enviar.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("O ficheiro excede o limite de 10MB.");
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Tipo de ficheiro não suportado.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = `orders/${orderId}/${crypto.randomUUID()}-${file.name}`;

  await uploadDocumentFile(storageKey, buffer, file.type);

  await prisma.orderDocument.create({
    data: {
      orderId,
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedById: user.id,
      uploadedByName:
        user.name ?? (user.role === "ADMIN" ? "Administração" : "Cliente"),
    },
  });

  revalidatePath(`/admin/ordens/${orderId}`);
  revalidatePath(`/dashboard/ordens/${orderId}`);
}

export async function deleteOrderDocument(documentId: string) {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error("Não autorizado.");

  const doc = await prisma.orderDocument.findUnique({
    where: { id: documentId },
    include: { order: true },
  });
  if (!doc) throw new Error("Documento não encontrado.");

  const isAdmin = user.role === "ADMIN";
  const isOwner = doc.uploadedById === user.id;
  if (!isAdmin && (!isOwner || doc.order.companyId !== user.companyId)) {
    throw new Error("Não autorizado.");
  }

  await deleteDocumentFile(doc.storageKey);
  await prisma.orderDocument.delete({ where: { id: documentId } });

  revalidatePath(`/admin/ordens/${doc.orderId}`);
  revalidatePath(`/dashboard/ordens/${doc.orderId}`);
}

export async function getOrderDocumentDownloadUrl(documentId: string) {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error("Não autorizado.");

  const doc = await prisma.orderDocument.findUnique({
    where: { id: documentId },
    include: { order: true },
  });
  if (!doc) throw new Error("Documento não encontrado.");
  if (user.role !== "ADMIN" && doc.order.companyId !== user.companyId) {
    throw new Error("Não autorizado.");
  }

  return getDocumentDownloadUrl(doc.storageKey);
}
