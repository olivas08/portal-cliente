"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { AppError } from "@/lib/errors";
import { inviteUser, setUserActive, listUsersInScope, type InvitedUserVM } from "@/services/users.service";
import { ADMIN_ROLES, type AdminRole } from "@/lib/roles";
import { idSchema, booleanSchema } from "@/lib/schemas";

const ADMIN_USERS_PATH = "/admin/utilizadores";

export async function listAdminUsers(): Promise<InvitedUserVM[]> {
  await requireSuperAdmin();
  return listUsersInScope({ companyId: null });
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

export async function setAdminUserActive(
  userId: string,
  active: boolean,
): Promise<InviteAdminUserResult> {
  const actor = await requireSuperAdmin();
  const parsedId = idSchema.parse(userId);
  const parsedActive = booleanSchema.parse(active);
  if (parsedId === actor.id && !parsedActive) {
    return { ok: false, error: "Não pode desativar a sua própria conta." };
  }

  try {
    await setUserActive(parsedId, parsedActive, { companyId: null });
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath(ADMIN_USERS_PATH);
  return { ok: true };
}
