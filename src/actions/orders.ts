"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import type { OrderStatus } from "@/lib/types";
import {
  changeOrderStatus,
  createOrder as createOrderService,
  createOrderSchema,
  orderStatusSchema,
  type CreateOrderInput,
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
