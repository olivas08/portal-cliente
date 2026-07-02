"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const createRequestSchema = z.object({
  type: z.enum(["quote", "complaint", "info", "other"]),
  subject: z.string().trim().min(1, "Assunto obrigatório.").max(200),
  text: z.string().trim().min(1, "Mensagem obrigatória.").max(5000),
});

const requestStatusSchema = z.enum([
  "open",
  "in_review",
  "responded",
  "closed",
]);

export async function createRequest(input: {
  type: string;
  subject: string;
  text: string;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user || user.role !== "CLIENT" || !user.companyId) {
    throw new Error("Não autorizado.");
  }

  const data = createRequestSchema.parse(input);

  const year = new Date().getFullYear();
  const count = await prisma.request.count({
    where: { reference: { startsWith: `REQ-${year}-` } },
  });
  const reference = `REQ-${year}-${String(count + 1).padStart(3, "0")}`;

  const request = await prisma.request.create({
    data: {
      reference,
      companyId: user.companyId,
      type: data.type,
      subject: data.subject,
      status: "open",
      messages: {
        create: {
          from: "client",
          authorName: user.name ?? "Cliente",
          text: data.text,
        },
      },
    },
  });

  revalidatePath("/dashboard/requerimentos");
  revalidatePath("/admin/requerimentos");
  return request.id;
}

export async function addRequestMessage(requestId: string, rawText: string) {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error("Não autorizado.");

  const text = z.string().trim().min(1).max(5000).parse(rawText);

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });
  if (!request) throw new Error("Requerimento não encontrado.");

  const isAdmin = user.role === "ADMIN";
  // Clients may only post to their own company's requests.
  if (!isAdmin && request.companyId !== user.companyId) {
    throw new Error("Não autorizado.");
  }
  if (request.status === "closed") {
    throw new Error("Requerimento fechado.");
  }

  const from = isAdmin ? "admin" : "client";
  const newStatus =
    from === "admin"
      ? "responded"
      : request.status === "responded"
      ? "open"
      : request.status;

  await prisma.$transaction([
    prisma.requestMessage.create({
      data: {
        requestId,
        from,
        authorName: user.name ?? (isAdmin ? "Administração" : "Cliente"),
        text,
      },
    }),
    prisma.request.update({
      where: { id: requestId },
      data: { status: newStatus },
    }),
  ]);

  revalidatePath(`/dashboard/requerimentos/${requestId}`);
  revalidatePath(`/admin/requerimentos/${requestId}`);
  revalidatePath("/dashboard/requerimentos");
  revalidatePath("/admin/requerimentos");
}

export async function updateRequestStatus(requestId: string, status: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Não autorizado.");
  }

  const parsed = requestStatusSchema.parse(status);
  await prisma.request.update({
    where: { id: requestId },
    data: { status: parsed },
  });

  revalidatePath(`/admin/requerimentos/${requestId}`);
  revalidatePath(`/dashboard/requerimentos/${requestId}`);
  revalidatePath("/admin/requerimentos");
}
