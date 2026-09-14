import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findMany: vi.fn() },
    notification: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import {
  notifyAdmins,
  notifyCompanyClients,
  listNotifications,
  countUnread,
  markRead,
  markAllRead,
} from "@/services/notifications.service";

const sample = {
  type: "ORDER_CREATED" as const,
  title: "Nova encomenda",
  body: "Corpo",
  href: "/admin/ordens/o1",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
  prismaMock.notification.createMany.mockResolvedValue({ count: 2 });
});

describe("notifyAdmins", () => {
  it("creates one notification per admin user", async () => {
    await notifyAdmins(sample);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        role: {
          in: ["ADMIN", "PRODUCTION_MANAGER", "WAREHOUSE_MANAGER", "SALES_MANAGER", "QUALITY_MANAGER"],
        },
        id: undefined,
      },
      select: { id: true },
    });
    const arg = prismaMock.notification.createMany.mock.calls[0][0];
    expect(arg.data).toEqual([
      { userId: "u1", ...sample },
      { userId: "u2", ...sample },
    ]);
  });

  it("excludes the actor when excludeUserId is given", async () => {
    await notifyAdmins(sample, "u1");
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        role: {
          in: ["ADMIN", "PRODUCTION_MANAGER", "WAREHOUSE_MANAGER", "SALES_MANAGER", "QUALITY_MANAGER"],
        },
        id: { not: "u1" },
      },
      select: { id: true },
    });
  });

  it("does not create anything when there are no recipients", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await notifyAdmins(sample);
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });

  it("swallows errors so the core operation is never broken", async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error("db down"));
    await expect(notifyAdmins(sample)).resolves.toBeUndefined();
  });
});

describe("notifyCompanyClients", () => {
  it("targets CLIENT users of the company, excluding the actor", async () => {
    await notifyCompanyClients("c1", sample, "u2");
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { companyId: "c1", role: { in: ["CLIENT", "CLIENT_USER"] }, id: { not: "u2" } },
      select: { id: true },
    });
  });
});

describe("listNotifications", () => {
  it("maps rows to view models with read flag and ISO date", async () => {
    const created = new Date("2026-07-21T10:00:00.000Z");
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: "n1",
        type: "ORDER_STATUS",
        title: "T",
        body: "B",
        href: "/x",
        readAt: null,
        createdAt: created,
      },
      {
        id: "n2",
        type: "ORDER_STATUS",
        title: "T2",
        body: "B2",
        href: "/y",
        readAt: new Date(),
        createdAt: created,
      },
    ]);
    const vms = await listNotifications("u1");
    expect(vms[0]).toEqual({
      id: "n1",
      type: "ORDER_STATUS",
      title: "T",
      body: "B",
      href: "/x",
      read: false,
      createdAt: created.toISOString(),
    });
    expect(vms[1].read).toBe(true);
  });
});

describe("countUnread", () => {
  it("counts only unread notifications for the user", async () => {
    prismaMock.notification.count.mockResolvedValue(3);
    const n = await countUnread("u1");
    expect(n).toBe(3);
    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: { userId: "u1", readAt: null },
    });
  });
});

describe("markRead / markAllRead", () => {
  it("marks a single notification read scoped to its owner", async () => {
    await markRead("u1", "n1");
    const arg = prismaMock.notification.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "n1", userId: "u1", readAt: null });
    expect(arg.data.readAt).toBeInstanceOf(Date);
  });

  it("marks all the user's unread notifications read", async () => {
    await markAllRead("u1");
    const arg = prismaMock.notification.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: "u1", readAt: null });
  });
});
