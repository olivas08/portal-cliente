"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { AppError } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  requestPasswordResetForEmail,
  resetPasswordWithToken,
} from "@/services/auth.service";

export type LoginResult = "ok" | "invalid" | "error" | "rate-limited";

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function loginAction(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    const ip = await getClientIp();
    const normalizedEmail = email.trim().toLowerCase();
    const skipRateLimit =
      process.env.CI === "true" || process.env.E2E_TEST === "true";
    if (!skipRateLimit) {
      const [emailOk, ipOk] = await Promise.all([
        checkRateLimit(`login:email:${normalizedEmail}`, { max: 8, windowMs: 15 * 60 * 1000 }),
        checkRateLimit(`login:ip:${ip}`, { max: 30, windowMs: 15 * 60 * 1000 }),
      ]);
      if (!emailOk || !ipOk) return "rate-limited";
    }

    await signIn("credentials", {
      email,
      password,
      // Let Next/Auth.js finish with a redirect. `redirect: false` can leave
      // the Server Action waiting on its own /api/auth round-trip until Vercel
      // kills the function at 300s.
      redirectTo: "/",
    });
    return "ok";
  } catch (error) {
    // Auth.js / Next may still throw a redirect; swallowing it hangs the action.
    if (isNextRedirect(error)) throw error;
    if (error instanceof AuthError) {
      return "invalid";
    }
    return "error";
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Public self-registration is closed. New client companies are created by
 * the factory from `/admin/clientes` (`onboardClientCompany`). This action
 * exists only so leftover callers fail closed instead of creating a tenant.
 */
export async function registerAction(input?: {
  companyName: string;
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  void input;
  return {
    ok: false,
    error:
      "O registo público está desativado. Contacte a fábrica para receber um convite.",
  };
}

export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = z.string().trim().toLowerCase().email().safeParse(rawEmail);
  if (!email.success) return;

  const allowed = await checkRateLimit(`reset-request:${email.data}`, {
    max: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) return;

  await requestPasswordResetForEmail(email.data);
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string };

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  const ip = await getClientIp();
  const ipOk = await checkRateLimit(`reset-password:ip:${ip}`, {
    max: 15,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipOk) {
    return { ok: false, error: "Demasiadas tentativas. Tente novamente dentro de alguns minutos." };
  }

  try {
    await resetPasswordWithToken(token, newPassword);
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
