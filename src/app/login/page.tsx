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
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
