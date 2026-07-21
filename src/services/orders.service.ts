import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/url";
import { sendOrderStatusUpdateEmail } from "@/lib/email";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { NotFoundError } from "@/lib/errors";
import { assertCompanyAccess, type SessionUser } from "@/lib/auth-guard";
import { computeStatusDates } from "@/services/order-status";
import { createWithReference } from "@/services/reference.service";
import { notifyAdmins, notifyCompanyClients } from "@/services/notifications.service";

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

export const reorderSchema = z.object({
  sourceOrderId: z.string().trim().min(1, "Encomenda de origem obrigatória."),
  expectedDate: z.string().trim().min(1, "Data desejada obrigatória."),
  observations: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        sourceItemId: z.string().trim().min(1),
        quantity: z.coerce.number().positive("Quantidade deve ser maior que zero."),
      }),
    )
    .min(1, "Selecione pelo menos um artigo."),
});

export type ReorderInput = z.infer<typeof reorderSchema>;

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

  await notifyCompanyClients(existing.companyId, {
    type: "ORDER_STATUS",
    title: `Encomenda ${existing.reference}`,
    body: `Novo estado: ${ORDER_STATUS_LABELS[status]}.`,
    href: `/dashboard/ordens/${existing.id}`,
  });
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

  await notifyCompanyClients(data.companyId, {
    type: "ORDER_CREATED",
    title: `Nova encomenda ${order.reference}`,
    body: "Foi registada uma nova encomenda no portal.",
    href: `/dashboard/ordens/${order.id}`,
  });

  return order.id;
}

/**
 * Client self-service reorder: clones the line items of a past order the actor
 * owns into a brand-new order in the `pending` state, ready for the factory to
 * confirm by advancing its status. Item reference/description/unit/price are
 * copied from the source order server-side (never trusted from the client) —
 * the client may only choose which lines to repeat and in what quantity. The
 * batch number is intentionally left null: the factory assigns a lot when it
 * starts production.
 */
export async function reorderOrder(
  actor: SessionUser,
  data: ReorderInput,
): Promise<string> {
  const source = await prisma.order.findUnique({
    where: { id: data.sourceOrderId },
    include: { items: true, company: true },
  });
  if (!source) throw new NotFoundError("Encomenda não encontrada.");
  assertCompanyAccess(actor, source.companyId);

  const sourceItemsById = new Map(source.items.map((item) => [item.id, item]));
  const items = data.items.map((line) => {
    const src = sourceItemsById.get(line.sourceItemId);
    if (!src) {
      throw new NotFoundError("Artigo não encontrado na encomenda original.");
    }
    return {
      reference: src.reference,
      description: src.description,
      quantity: line.quantity,
      unit: src.unit,
      unitPriceEur: src.unitPriceEur,
    };
  });

  const order = await createWithReference("ENC", (reference) =>
    prisma.order.create({
      data: {
        reference,
        companyId: source.companyId,
        status: "pending",
        priority: "normal",
        batchNumber: null,
        createdDate: new Date(),
        expectedDate: new Date(data.expectedDate),
        observations: data.observations || undefined,
        items: { create: items },
      },
    }),
  );

  await notifyAdmins({
    type: "ORDER_CREATED",
    title: `Nova encomenda ${order.reference}`,
    body: `${source.company?.name ?? "Um cliente"} solicitou uma nova encomenda.`,
    href: `/admin/ordens/${order.id}`,
  });

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
