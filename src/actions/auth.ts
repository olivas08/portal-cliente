"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

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
