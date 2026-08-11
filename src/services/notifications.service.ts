import { prisma } from "@/lib/prisma";
import type { NotificationType, NotificationVM } from "@/lib/types";
import { ADMIN_ROLES, CLIENT_ROLES } from "@/lib/roles";

interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  href: string;
}

/** Users who should receive "factory-side" notifications. */
async function adminUserIds(excludeUserId?: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [...ADMIN_ROLES] },
      id: excludeUserId ? { not: excludeUserId } : undefined,
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Client users belonging to a given company. */
async function companyClientUserIds(
  companyId: string,
  excludeUserId?: string,
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      companyId,
      role: { in: [...CLIENT_ROLES] },
      id: excludeUserId ? { not: excludeUserId } : undefined,
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function notifyUsers(
  userIds: string[],
  data: NotificationInput,
): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, ...data })),
  });
}

/**
 * Notification dispatch is always best-effort: an in-app notification must
 * never break the business operation that triggered it (status change, new
 * message, …). Failures are logged and swallowed.
 */
export async function notifyAdmins(
  data: NotificationInput,
  excludeUserId?: string,
): Promise<void> {
  try {
    await notifyUsers(await adminUserIds(excludeUserId), data);
  } catch (err) {
    console.error("[notifications] Falha ao notificar administradores:", err);
  }
}

export async function notifyCompanyClients(
  companyId: string,
  data: NotificationInput,
  excludeUserId?: string,
): Promise<void> {
  try {
    await notifyUsers(await companyClientUserIds(companyId, excludeUserId), data);
  } catch (err) {
    console.error("[notifications] Falha ao notificar clientes:", err);
  }
}

export async function listNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationVM[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Marks a single notification read, scoped to its owner (no cross-user leak). */
export async function markRead(userId: string, id: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
