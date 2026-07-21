import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import { assertCompanyAccess, type ClientUser, type SessionUser } from "@/lib/auth-guard";
import { createWithReference } from "@/services/reference.service";
import { notifyAdmins, notifyCompanyClients } from "@/services/notifications.service";
import type { MessageFrom, RequestStatus } from "@/lib/types";

export const createRequestSchema = z.object({
  type: z.enum(["quote", "complaint", "info", "other"]),
  subject: z.string().trim().min(1, "Assunto obrigatório.").max(200),
  text: z.string().trim().min(1, "Mensagem obrigatória.").max(5000),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const requestStatusSchema = z.enum([
  "open",
  "in_review",
  "responded",
  "closed",
]);

export const requestMessageSchema = z.string().trim().min(1).max(5000);

/**
 * Status transition triggered by a new message:
 * - an admin reply marks the thread `responded`;
 * - a client reply to a `responded` thread reopens it (`open`);
 * - otherwise the status is unchanged.
 */
export function nextRequestStatusAfterMessage(
  from: MessageFrom,
  currentStatus: RequestStatus,
): RequestStatus {
  if (from === "admin") return "responded";
  return currentStatus === "responded" ? "open" : currentStatus;
}

export async function createRequest(
  actor: ClientUser,
  data: CreateRequestInput,
): Promise<string> {
  const request = await createWithReference("REQ", (reference) =>
    prisma.request.create({
      data: {
        reference,
        companyId: actor.companyId,
        type: data.type,
        subject: data.subject,
        status: "open",
        messages: {
          create: {
            from: "client",
            authorName: actor.name ?? "Cliente",
            text: data.text,
          },
        },
      },
    }),
  );

  await notifyAdmins({
    type: "REQUEST_CREATED",
    title: `Novo requerimento ${request.reference}`,
    body: `${actor.name ?? "Cliente"}: ${data.subject}`,
    href: `/admin/requerimentos/${request.id}`,
  });

  return request.id;
}

export async function addRequestMessage(
  actor: SessionUser,
  requestId: string,
  text: string,
): Promise<void> {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Requerimento não encontrado.");

  // Admins may post to any request; clients only to their own company's.
  assertCompanyAccess(actor, request.companyId);
  if (request.status === "closed") {
    throw new AppError("Requerimento fechado.");
  }

  const isAdmin = actor.role === "ADMIN";
  const from: MessageFrom = isAdmin ? "admin" : "client";
  const newStatus = nextRequestStatusAfterMessage(from, request.status);

  await prisma.$transaction([
    prisma.requestMessage.create({
      data: {
        requestId,
        from,
        authorName: actor.name ?? (isAdmin ? "Administração" : "Cliente"),
        text,
      },
    }),
    prisma.request.update({
      where: { id: requestId },
      data: { status: newStatus },
    }),
  ]);

  if (isAdmin) {
    await notifyCompanyClients(
      request.companyId,
      {
        type: "REQUEST_MESSAGE",
        title: `Requerimento ${request.reference}`,
        body: "Nova resposta da fábrica.",
        href: `/dashboard/requerimentos/${requestId}`,
      },
      actor.id,
    );
  } else {
    await notifyAdmins(
      {
        type: "REQUEST_MESSAGE",
        title: `Requerimento ${request.reference}`,
        body: `Nova mensagem de ${actor.name ?? "cliente"}.`,
        href: `/admin/requerimentos/${requestId}`,
      },
      actor.id,
    );
  }
}

export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
): Promise<void> {
  await prisma.request.update({
    where: { id: requestId },
    data: { status },
  });
}
