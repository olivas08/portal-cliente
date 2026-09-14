import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { sendPasswordResetEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/url";
import { createResetToken, hashToken } from "@/lib/reset-token";

const passwordSchema = z
  .string()
  .min(6, "A palavra-passe deve ter pelo menos 6 caracteres.");

/**
 * Creates a reset token for a known user. Callers must not distinguish
 * unknown emails — this function is a no-op when the user does not exist.
 */
export async function requestPasswordResetForEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const token = await createResetToken(user.id);
  const baseUrl = await getBaseUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

/**
 * Consumes a password-reset (or invite-setup) token. Also (re)activates the
 * account so the same flow completes an invited user's first sign-up.
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<void> {
  const password = passwordSchema.safeParse(newPassword);
  if (!password.success) {
    throw new AppError(password.error.issues[0]?.message ?? "Palavra-passe inválida.");
  }
  if (!token) {
    throw new AppError("Link inválido.");
  }

  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("Este link é inválido ou já expirou.");
  }

  const passwordHash = await bcrypt.hash(password.data, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, active: true },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
