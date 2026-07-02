"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/types";

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
}
