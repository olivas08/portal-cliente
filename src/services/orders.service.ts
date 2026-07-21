import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/url";
import { sendOrderStatusUpdateEmail } from "@/lib/email";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { NotFoundError } from "@/lib/errors";
import { computeStatusDates } from "@/services/order-status";
import { createWithReference } from "@/services/reference.service";

export const orderStatusSchema = z.enum([
  "pending",
  "production",
  "quality",
  "shipped",
  "delivered",
]);

const createOrderItemSchema = z.object({
  reference: z.string().trim().min(1, "Referência obrigatória.").max(60),
  description: z.string().trim().min(1, "Descrição obrigatória.").max(200),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  unit: z.string().trim().min(1, "Unidade obrigatória.").max(20),
  unitPriceEur: z.coerce.number().nonnegative("Preço não pode ser negativo."),
});

export const createOrderSchema = z.object({
  companyId: z.string().trim().min(1, "Cliente obrigatório."),
  batchNumber: z.string().trim().min(1, "Nº de lote obrigatório.").max(60),
  expectedDate: z.string().trim().min(1, "Data prevista obrigatória."),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  observations: z.string().trim().max(2000).optional(),
  items: z.array(createOrderItemSchema).min(1, "Adicione pelo menos um artigo."),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Applies a status change and its derived timestamps, then best-effort
 * notifies the client. Callers are responsible for authorization and cache
 * revalidation.
 */
export async function changeOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new NotFoundError("Encomenda não encontrada.");

  const dates = computeStatusDates(status, existing, new Date());

  await prisma.order.update({
    where: { id: orderId },
    data: { status, ...dates },
  });

  await notifyOrderStatusChange(
    existing.id,
    existing.companyId,
    existing.reference,
    status,
  );
}

export async function createOrder(data: CreateOrderInput): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: data.companyId },
  });
  if (!company) throw new NotFoundError("Cliente não encontrado.");

  const order = await createWithReference("ENC", (reference) =>
    prisma.order.create({
      data: {
        reference,
        companyId: data.companyId,
        status: "pending",
        priority: data.priority,
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
    }),
  );

  return order.id;
}

/**
 * Best-effort notification to the company's main client user. Email delivery
 * must never break the admin's status-update flow, so any failure (missing
 * user, missing email, Resend error) is only logged.
 */
async function notifyOrderStatusChange(
  orderId: string,
  companyId: string,
  reference: string,
  status: OrderStatus,
): Promise<void> {
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
