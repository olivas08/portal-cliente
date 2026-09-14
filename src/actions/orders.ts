"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea, requireClient, requireUser } from "@/lib/auth-guard";
import { idSchema } from "@/lib/schemas";
import type { OrderStatus } from "@/lib/types";
import {
  changeOrderStatus,
  cancelOrder as cancelOrderService,
  reactivateOrder as reactivateOrderService,
  createOrder as createOrderService,
  reorderOrder as reorderOrderService,
  createOrderSchema,
  reorderSchema,
  cancelOrderSchema,
  orderStatusSchema,
  type CreateOrderInput,
  type ReorderInput,
} from "@/services/orders.service";

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await requireAdminArea("producao");
  const parsed = orderStatusSchema.parse(status);
  const parsedId = idSchema.parse(orderId);

  await changeOrderStatus(parsedId, parsed);

  revalidatePath(`/admin/ordens/${parsedId}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/ordens/${parsedId}`);
}

export async function createOrder(input: CreateOrderInput) {
  await requireAdminArea("producao");
  const data = createOrderSchema.parse(input);

  const id = await createOrderService(data);

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return id;
}

export async function reorderOrder(input: ReorderInput) {
  const actor = await requireClient();
  const data = reorderSchema.parse(input);

  const id = await reorderOrderService(actor, data);

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return id;
}

export async function cancelOrder(orderId: string, reason: string) {
  const actor = await requireUser();
  const { reason: parsedReason } = cancelOrderSchema.parse({ reason });
  const parsedId = idSchema.parse(orderId);

  await cancelOrderService(actor, parsedId, parsedReason);

  revalidatePath(`/admin/ordens/${parsedId}`);
  revalidatePath(`/dashboard/ordens/${parsedId}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function reactivateOrder(orderId: string) {
  await requireAdminArea("producao");
  const parsedId = idSchema.parse(orderId);

  await reactivateOrderService(parsedId);

  revalidatePath(`/admin/ordens/${parsedId}`);
  revalidatePath(`/dashboard/ordens/${parsedId}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
