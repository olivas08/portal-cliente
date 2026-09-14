import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { sendInviteEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/url";
import { createResetToken } from "@/lib/reset-token";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
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

  if (params.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: params.companyId },
      select: { id: true },
    });
    if (!company) throw new AppError("Cliente não encontrado.");
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

  await sendSetupInvite(user, params.inviterName);
  if (params.companyId) invalidateCache(CACHE_TAGS.companies);
  return toInvitedUserVM(user);
}

/**
 * Factory onboarding: create the client company and invite its first
 * company-admin (`CLIENT`) in one transaction. Public `/registo` no longer
 * does this.
 */
export async function onboardClientCompany(params: {
  companyName: string;
  contactName: string;
  email: string;
  inviterName: string;
}): Promise<{ companyId: string; companyName: string; user: InvitedUserVM }> {
  const email = params.email.trim().toLowerCase();
  const companyName = params.companyName.trim();
  const contactName = params.contactName.trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Já existe uma conta com este email.");
  }

  const placeholderHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  const { company, user } = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: companyName } });
    const user = await tx.user.create({
      data: {
        name: contactName,
        email,
        passwordHash: placeholderHash,
        role: "CLIENT",
        companyId: company.id,
        active: false,
      },
    });
    return { company, user };
  });

  invalidateCache(CACHE_TAGS.companies);
  await sendSetupInvite(user, params.inviterName);
  return {
    companyId: company.id,
    companyName: company.name,
    user: toInvitedUserVM(user),
  };
}

async function sendSetupInvite(
  user: { id: string; name: string; email: string; role: Role },
  inviterName: string,
): Promise<void> {
  const token = await createResetToken(user.id);
  const baseUrl = await getBaseUrl();
  await sendInviteEmail(user.email, {
    name: user.name,
    roleLabel: ROLE_LABELS[user.role],
    setupUrl: `${baseUrl}/reset-password?token=${token}`,
    inviterName,
  });
}

function toInvitedUserVM(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: Date;
}): InvitedUserVM {
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
