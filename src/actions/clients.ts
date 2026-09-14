"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminArea } from "@/lib/auth-guard";
import { AppError } from "@/lib/errors";
import { CLIENT_ROLES, type ClientRole } from "@/lib/roles";
import { idSchema } from "@/lib/schemas";
import { inviteUser, onboardClientCompany } from "@/services/users.service";
import type { ClientCompanyVM } from "@/lib/types";

const CLIENTS_PATH = "/admin/clientes";

const onboardSchema = z.object({
  companyName: z.string().trim().min(2, "Nome da empresa obrigatório.").max(150),
  contactName: z.string().trim().min(2, "Nome do contacto obrigatório.").max(150),
  email: z.string().trim().toLowerCase().email("Email inválido."),
});

const inviteClientUserSchema = z.object({
  companyId: idSchema,
  name: z.string().trim().min(2, "Nome obrigatório.").max(150),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  role: z.enum(CLIENT_ROLES as unknown as [ClientRole, ...ClientRole[]]),
});

export type OnboardClientInput = z.infer<typeof onboardSchema>;
export type InviteClientUserInput = z.infer<typeof inviteClientUserSchema>;
export type ClientInviteResult =
  | { ok: true; company?: ClientCompanyVM }
  | { ok: false; error: string };

export async function onboardClientCompanyAction(
  input: OnboardClientInput,
): Promise<ClientInviteResult> {
  const actor = await requireAdminArea("comercial");
  const parsed = onboardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const created = await onboardClientCompany({
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName,
      email: parsed.data.email,
      inviterName: actor.name ?? "Administração",
    });
    revalidatePath(CLIENTS_PATH);
    return {
      ok: true,
      company: {
        id: created.companyId,
        name: created.companyName,
        users: [
          {
            id: created.user.id,
            name: created.user.name,
            email: created.user.email,
            role: created.user.role,
            active: created.user.active,
          },
        ],
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function inviteClientUserAction(
  input: InviteClientUserInput,
): Promise<ClientInviteResult> {
  const actor = await requireAdminArea("comercial");
  const parsed = inviteClientUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await inviteUser({
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      companyId: parsed.data.companyId,
      inviterName: actor.name ?? "Administração",
    });
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath(CLIENTS_PATH);
  return { ok: true };
}
