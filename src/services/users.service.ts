import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { sendInviteEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/url";
import { createResetToken } from "@/lib/reset-token";
import { ROLE_LABELS, type Role } from "@/lib/roles";

export interface InvitedUserVM {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: Date;
}

/**
 * Creates a not-yet-active user and emails them a "set your password" link
 * (same token mechanism as the forgot-password flow). Used both for
 * factory-side accounts (companyId null) and client company teammates
 * (companyId set). The account can't sign in until the link is used —
 * the placeholder password hash is a random value nobody can know.
 */
export async function inviteUser(params: {
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  inviterName: string;
}): Promise<InvitedUserVM> {
  const email = params.email.trim().toLowerCase();
  const name = params.name.trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Já existe uma conta com este email.");
  }

  const placeholderHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: placeholderHash,
      role: params.role,
      companyId: params.companyId,
      active: false,
    },
  });

  const token = await createResetToken(user.id);
  const baseUrl = await getBaseUrl();
  const setupUrl = `${baseUrl}/reset-password?token=${token}`;

  await sendInviteEmail(email, {
    name,
    roleLabel: ROLE_LABELS[params.role],
    setupUrl,
    inviterName: params.inviterName,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
}

export async function setUserActive(
  userId: string,
  active: boolean,
  scope: { companyId: string | null },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("Utilizador não encontrado.");
  // scope.companyId is null for factory-side management (only factory
  // accounts, themselves companyId=null, may be touched) and the company id
  // for a client company-admin (only their own company's users).
  if (user.companyId !== scope.companyId) {
    throw new AppError("Utilizador não pertence a este âmbito.");
  }
  await prisma.user.update({ where: { id: userId }, data: { active } });
}

export async function listUsersInScope(scope: {
  companyId: string | null;
}): Promise<InvitedUserVM[]> {
  return prisma.user.findMany({
    where: { companyId: scope.companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
}
