"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { markAllRead, markRead } from "@/services/notifications.service";

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await markRead(user.id, id);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
