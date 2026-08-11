"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { inviteUser, setUserActive, type InvitedUserVM } from "@/services/users.service";
import { ADMIN_ROLES, type AdminRole } from "@/lib/roles";

const ADMIN_USERS_PATH = "/admin/utilizadores";

export async function listAdminUsers(): Promise<InvitedUserVM[]> {
  await requireSuperAdmin();
  const users = await prisma.user.findMany({
    where: { companyId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return users;
}

const inviteAdminUserSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório.").max(150),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  role: z.enum(ADMIN_ROLES as unknown as [AdminRole, ...AdminRole[]]),
});

export type InviteAdminUserInput = z.infer<typeof inviteAdminUserSchema>;

export type InviteAdminUserResult =
  | { ok: true }
  | { ok: false; error: string };

export async function inviteAdminUser(
  input: InviteAdminUserInput,
): Promise<InviteAdminUserResult> {
  const actor = await requireSuperAdmin();
  const parsed = inviteAdminUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await inviteUser({
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      companyId: null,
      inviterName: actor.name ?? "Administração",
    });
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath(ADMIN_USERS_PATH);
  return { ok: true };
}

export async function setAdminUserActive(userId: string, active: boolean): Promise<void> {
  const actor = await requireSuperAdmin();
  if (userId === actor.id && !active) {
    throw new AppError("Não pode desativar a sua própria conta.");
  }
  await setUserActive(userId, active, { companyId: null });
  revalidatePath(ADMIN_USERS_PATH);
}
