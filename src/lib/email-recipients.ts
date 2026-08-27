import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES, CLIENT_ROLES } from "@/lib/roles";

/** Active client users (company admin + teammates) with an email address. */
export async function companyClientEmails(companyId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      companyId,
      role: { in: [...CLIENT_ROLES] },
      active: true,
    },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  return users.map((u) => u.email).filter(Boolean);
}

/** Active factory-side users who should receive operational emails. */
export async function adminEmails(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [...ADMIN_ROLES] },
      active: true,
    },
    select: { email: true },
  });
  return users.map((u) => u.email).filter(Boolean);
}
