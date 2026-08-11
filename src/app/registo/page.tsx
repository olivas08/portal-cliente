import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/roles";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) {
    redirect(isAdminRole(session.user.role) ? "/admin" : "/dashboard");
  }
  return <RegisterForm />;
}
