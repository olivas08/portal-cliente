import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminRole, roleHasArea } from "@/lib/roles";

export default async function ClientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !isAdminRole(role) || !roleHasArea(role, "comercial")) {
    redirect("/admin");
  }
  return children;
}
