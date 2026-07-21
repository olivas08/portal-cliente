"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireClient } from "@/lib/auth-guard";
import type { OrderStatus } from "@/lib/types";
import {
  changeOrderStatus,
  createOrder as createOrderService,
  reorderOrder as reorderOrderService,
  createOrderSchema,
  reorderSchema,
  orderStatusSchema,
  type CreateOrderInput,
  type ReorderInput,
} from "@/services/orders.service";

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await requireAdmin();
  const parsed = orderStatusSchema.parse(status);

  await changeOrderStatus(orderId, parsed);

  revalidatePath(`/admin/ordens/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/ordens/${orderId}`);
}

export async function createOrder(input: CreateOrderInput) {
  await requireAdmin();
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
