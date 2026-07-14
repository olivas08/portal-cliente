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

// Extension -> canonical MIME type for every format we accept. Some browsers/
// OS combinations (cloud-synced folders, certain Android/Windows setups)
// report an empty or generic `file.type` ("application/octet-stream")
// instead of the real MIME type, so we validate — and fall back to — the
// file extension rather than trusting `file.type` alone.
const ALLOWED_EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};
const ALLOWED_MIME_TYPES = new Set(Object.values(ALLOWED_EXTENSIONS));
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);

function extensionOf(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
}

/**
 * Resolves the MIME type to trust for a given upload: the browser-reported
 * type when it's meaningful, otherwise the canonical type for its extension.
 * Returns null when neither the reported type nor the extension is allowed.
 */
function resolveAllowedMimeType(file: File): string | null {
  if (ALLOWED_MIME_TYPES.has(file.type)) return file.type;
  if (GENERIC_MIME_TYPES.has(file.type)) {
    const canonical = ALLOWED_EXTENSIONS[extensionOf(file.name)];
    if (canonical) return canonical;
  }
  return null;
}

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
  const mimeType = resolveAllowedMimeType(file);
  if (!mimeType) {
    throw new Error("Tipo de ficheiro não suportado.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = `orders/${orderId}/${crypto.randomUUID()}-${file.name}`;

  await uploadDocumentFile(storageKey, buffer, mimeType);

  await prisma.orderDocument.create({
    data: {
      orderId,
      fileName: file.name,
      storageKey,
      mimeType,
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
