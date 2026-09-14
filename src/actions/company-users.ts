"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompanyAdmin } from "@/lib/auth-guard";
import { AppError } from "@/lib/errors";
import { inviteUser, setUserActive, listUsersInScope, type InvitedUserVM } from "@/services/users.service";
import { idSchema, booleanSchema } from "@/lib/schemas";

const DASHBOARD_USERS_PATH = "/dashboard/utilizadores";

export async function listCompanyUsers(): Promise<InvitedUserVM[]> {
  const actor = await requireCompanyAdmin();
  return listUsersInScope({ companyId: actor.companyId });
}

const inviteCompanyUserSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório.").max(150),
  email: z.string().trim().toLowerCase().email("Email inválido."),
});

export type InviteCompanyUserInput = z.infer<typeof inviteCompanyUserSchema>;

export type InviteCompanyUserResult =
  | { ok: true; user?: InvitedUserVM }
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
    const user = await inviteUser({
      name: parsed.data.name,
      email: parsed.data.email,
      role: "CLIENT_USER",
      companyId: actor.companyId,
      inviterName: actor.name ?? "Administrador da empresa",
    });
    revalidatePath(DASHBOARD_USERS_PATH);
    return { ok: true, user };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function setCompanyUserActive(
  userId: string,
  active: boolean,
): Promise<InviteCompanyUserResult> {
  const actor = await requireCompanyAdmin();
  const parsedId = idSchema.parse(userId);
  const parsedActive = booleanSchema.parse(active);
  if (parsedId === actor.id && !parsedActive) {
    return { ok: false, error: "Não pode desativar a sua própria conta." };
  }

  try {
    await setUserActive(parsedId, parsedActive, { companyId: actor.companyId });
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath(DASHBOARD_USERS_PATH);
  return { ok: true };
}
