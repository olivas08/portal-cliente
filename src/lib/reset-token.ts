import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Shared by the "forgot password" flow and the "set your password" step of
// invited accounts (factory + client sub-users) — both just need a
// short-lived, single-use link to a user's `/reset-password` page.
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a reset token for `userId` and returns the raw (unhashed) value to embed in the email link. */
export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return token;
}
