import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/roles";
import { LoginForm } from "./LoginForm";

export const maxDuration = 30;

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(isAdminRole(session.user.role) ? "/admin" : "/dashboard");
  }
  // NODE_ENV is "production" on Vercel Preview too. VERCEL_ENV is
  // "production" | "preview" | "development" — demo logins stay on
  // Preview + local, never on the factory's production domain.
  const showDemoAccounts = process.env.VERCEL_ENV !== "production";

  return (
    <Suspense>
      <LoginForm showDemoAccounts={showDemoAccounts} />
    </Suspense>
  );
}
