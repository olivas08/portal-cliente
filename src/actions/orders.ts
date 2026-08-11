"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea, requireClient, requireUser } from "@/lib/auth-guard";
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

  await changeOrderStatus(orderId, parsed);

  revalidatePath(`/admin/ordens/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/ordens/${orderId}`);
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

  await cancelOrderService(actor, orderId, parsedReason);

  revalidatePath(`/admin/ordens/${orderId}`);
  revalidatePath(`/dashboard/ordens/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function reactivateOrder(orderId: string) {
  await requireAdminArea("producao");

  await reactivateOrderService(orderId);

  revalidatePath(`/admin/ordens/${orderId}`);
  revalidatePath(`/dashboard/ordens/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
