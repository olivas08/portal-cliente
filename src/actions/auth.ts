"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { sendPasswordResetEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/url";
import { createResetToken, hashToken } from "@/lib/reset-token";

export type LoginResult = "ok" | "invalid" | "error";

export async function loginAction(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    await signIn("credentials", { email, password, redirect: false });
    return "ok";
  } catch (error) {
    if (error instanceof AuthError) {
      return "invalid";
    }
    return "error";
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

const registerSchema = z.object({
  companyName: z.string().trim().min(2, "Nome da empresa obrigatório.").max(150),
  name: z.string().trim().min(2, "Nome obrigatório.").max(150),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  password: z.string().min(6, "A palavra-passe deve ter pelo menos 6 caracteres."),
});

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string };

export async function registerAction(input: {
  companyName: string;
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { companyName, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Já existe uma conta com este email." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: companyName } });
    await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "CLIENT",
        companyId: company.id,
      },
    });
  });
  invalidateCache(CACHE_TAGS.companies);

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch {
    // Account was created successfully even if the auto-login fails;
    // the user can still log in manually with their new credentials.
  }

  return { ok: true };
}

export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = z.string().trim().toLowerCase().email().safeParse(rawEmail);
  if (!email.success) return;

  const user = await prisma.user.findUnique({ where: { email: email.data } });
  // Always behave the same way regardless of whether the user exists,
  // to avoid leaking which emails are registered.
  if (!user) return;

  const token = await createResetToken(user.id);

  const baseUrl = await getBaseUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string };

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  const password = z
    .string()
    .min(6, "A palavra-passe deve ter pelo menos 6 caracteres.")
    .safeParse(newPassword);
  if (!password.success) {
    return { ok: false, error: password.error.issues[0]?.message ?? "Palavra-passe inválida." };
  }
  if (!token) {
    return { ok: false, error: "Link inválido." };
  }

  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "Este link é inválido ou já expirou." };
  }

  const passwordHash = await bcrypt.hash(password.data, 10);

  await prisma.$transaction([
    prisma.user.update({
      // Also (re)activates the account — this same flow completes an
      // invited user's very first sign-up, not just password resets.
      where: { id: record.userId },
      data: { passwordHash, active: true },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

