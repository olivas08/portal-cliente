"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/url";
import { sendOrderStatusUpdateEmail } from "@/lib/email";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";

const statusSchema = z.enum([
  "pending",
  "production",
  "quality",
  "shipped",
  "delivered",
]);

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Não autorizado.");
  }

  const parsedStatus = statusSchema.parse(status);
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new Error("Encomenda não encontrada.");

  const now = new Date();
  const shippedDate =
    parsedStatus === "shipped"
      ? now
      : ["pending", "production", "quality"].includes(parsedStatus)
      ? null
      : existing.shippedDate;
  const deliveredDate = parsedStatus === "delivered" ? now : null;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: parsedStatus, shippedDate, deliveredDate },
  });

  revalidatePath(`/admin/ordens/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/ordens/${orderId}`);

  await notifyOrderStatusChange(orderId, existing.companyId, existing.reference, parsedStatus);
}

/**
 * Best-effort notification to the company's main client user.
 * Email delivery must never break the admin's status-update flow, so
 * any failure (missing user, missing email, Resend error) is only logged.
 */
async function notifyOrderStatusChange(
  orderId: string,
  companyId: string,
  reference: string,
  status: OrderStatus
) {
  try {
    const clientUser = await prisma.user.findFirst({
      where: { companyId, role: "CLIENT" },
      orderBy: { createdAt: "asc" },
    });
    if (!clientUser?.email) return;

    const baseUrl = await getBaseUrl();
    await sendOrderStatusUpdateEmail(clientUser.email, {
      reference,
      statusLabel: ORDER_STATUS_LABELS[status],
      orderUrl: `${baseUrl}/dashboard/ordens/${orderId}`,
    });
  } catch (err) {
    console.error("[orders] Falha ao notificar cliente por email:", err);
  }
}

const createOrderItemSchema = z.object({
  reference: z.string().trim().min(1, "Referência obrigatória.").max(60),
  description: z.string().trim().min(1, "Descrição obrigatória.").max(200),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  unit: z.string().trim().min(1, "Unidade obrigatória.").max(20),
  unitPriceEur: z.coerce.number().nonnegative("Preço não pode ser negativo."),
});

const createOrderSchema = z.object({
  companyId: z.string().trim().min(1, "Cliente obrigatório."),
  batchNumber: z.string().trim().min(1, "Nº de lote obrigatório.").max(60),
  expectedDate: z.string().trim().min(1, "Data prevista obrigatória."),
  observations: z.string().trim().max(2000).optional(),
  items: z.array(createOrderItemSchema).min(1, "Adicione pelo menos um artigo."),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export async function createOrder(input: CreateOrderInput) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Não autorizado.");
  }

  const data = createOrderSchema.parse(input);

  const company = await prisma.company.findUnique({
    where: { id: data.companyId },
  });
  if (!company) throw new Error("Cliente não encontrado.");

  const year = new Date().getFullYear();
  const count = await prisma.order.count({
    where: { reference: { startsWith: `ENC-${year}-` } },
  });
  const reference = `ENC-${year}-${String(count + 1).padStart(3, "0")}`;

  const order = await prisma.order.create({
    data: {
      reference,
      companyId: data.companyId,
      status: "pending",
      batchNumber: data.batchNumber,
      createdDate: new Date(),
      expectedDate: new Date(data.expectedDate),
      observations: data.observations || undefined,
      items: {
        create: data.items.map((item) => ({
          reference: item.reference,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceEur: item.unitPriceEur,
        })),
      },
    },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");

  return order.id;
}

