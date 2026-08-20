"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompanyAdmin } from "@/lib/auth-guard";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { inviteUser, setUserActive, type InvitedUserVM } from "@/services/users.service";

const DASHBOARD_USERS_PATH = "/dashboard/utilizadores";

export async function listCompanyUsers(): Promise<InvitedUserVM[]> {
  const actor = await requireCompanyAdmin();
  const users = await prisma.user.findMany({
    where: { companyId: actor.companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return users;
}

const inviteCompanyUserSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório.").max(150),
  email: z.string().trim().toLowerCase().email("Email inválido."),
});

export type InviteCompanyUserInput = z.infer<typeof inviteCompanyUserSchema>;

export type InviteCompanyUserResult =
  | { ok: true }
  | { ok: false; error: string };

export async function inviteCompanyUser(
  input: InviteCompanyUserInput,
): Promise<InviteCompanyUserResult> {
  const actor = await requireCompanyAdmin();
  const parsed = inviteCompanyUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await inviteUser({
      name: parsed.data.name,
      email: parsed.data.email,
      role: "CLIENT_USER",
      companyId: actor.companyId,
      inviterName: actor.name ?? "Administrador da empresa",
    });
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath(DASHBOARD_USERS_PATH);
  return { ok: true };
}

export async function setCompanyUserActive(
  userId: string,
  active: boolean,
): Promise<InviteCompanyUserResult> {
  const actor = await requireCompanyAdmin();
  if (userId === actor.id && !active) {
    return { ok: false, error: "Não pode desativar a sua própria conta." };
  }

  try {
    await setUserActive(userId, active, { companyId: actor.companyId });
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath(DASHBOARD_USERS_PATH);
  return { ok: true };
}
