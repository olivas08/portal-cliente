import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { assertCompanyAccess, type SessionUser } from "@/lib/auth-guard";
import { isAdminRole } from "@/lib/roles";
import { AppError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import {
  uploadDocumentFile,
  deleteDocumentFile,
  getDocumentDownloadUrl,
} from "@/lib/storage";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

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

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[/\\]/g, "_").replace(/^\.+/, "").slice(0, 180) || "ficheiro";
}

function resolveAllowedMimeType(file: File): string | null {
  if (ALLOWED_MIME_TYPES.has(file.type)) return file.type;
  if (GENERIC_MIME_TYPES.has(file.type)) {
    const canonical = ALLOWED_EXTENSIONS[extensionOf(file.name)];
    if (canonical) return canonical;
  }
  return null;
}

async function requireOrderAccess(user: SessionUser, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Encomenda não encontrada.");
  assertCompanyAccess(user, order.companyId);
  return order;
}

export async function uploadOrderDocumentForUser(
  user: SessionUser,
  orderId: string,
  file: File,
): Promise<void> {
  await requireOrderAccess(user, orderId);

  if (file.size === 0) {
    throw new AppError("Selecione um ficheiro para enviar.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new AppError("O ficheiro excede o limite de 10MB.");
  }
  const mimeType = resolveAllowedMimeType(file);
  if (!mimeType) {
    throw new AppError("Tipo de ficheiro não suportado.");
  }

  const safeName = sanitizeFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = `orders/${orderId}/${crypto.randomUUID()}-${safeName}`;

  await uploadDocumentFile(storageKey, buffer, mimeType);

  await prisma.orderDocument.create({
    data: {
      orderId,
      fileName: safeName,
      storageKey,
      mimeType,
      sizeBytes: file.size,
      uploadedById: user.id,
      uploadedByName:
        user.name ?? (isAdminRole(user.role) ? "Administração" : "Cliente"),
    },
  });
  invalidateCache(CACHE_TAGS.orders);
}

export async function deleteOrderDocumentForUser(
  user: SessionUser,
  documentId: string,
): Promise<string> {
  const doc = await prisma.orderDocument.findUnique({
    where: { id: documentId },
    include: { order: true },
  });
  if (!doc) throw new NotFoundError("Documento não encontrado.");

  const isAdmin = isAdminRole(user.role);
  const isOwner = doc.uploadedById === user.id;
  if (!isAdmin && (!isOwner || doc.order.companyId !== user.companyId)) {
    throw new UnauthorizedError();
  }

  await deleteDocumentFile(doc.storageKey);
  await prisma.orderDocument.delete({ where: { id: documentId } });
  invalidateCache(CACHE_TAGS.orders);
  return doc.orderId;
}

export async function getOrderDocumentDownloadUrlForUser(
  user: SessionUser,
  documentId: string,
): Promise<string> {
  const doc = await prisma.orderDocument.findUnique({
    where: { id: documentId },
    include: { order: true },
  });
  if (!doc) throw new NotFoundError("Documento não encontrado.");
  assertCompanyAccess(user, doc.order.companyId);
  return getDocumentDownloadUrl(doc.storageKey);
}
