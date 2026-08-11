import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminRole, roleHasArea } from "@/lib/roles";

/**
 * Read-access gate for the whole "Produção (Encomendas)" section (covers every nested
 * route). The real enforcement for writes lives in the corresponding
 * requireAdminArea() calls in src/actions/*.ts — this is a defense-in-depth
 * / UX guard so a role without this area doesn't even see the pages.
 */
export default async function OrdensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !isAdminRole(role) || !roleHasArea(role, "producao")) {
    redirect("/admin");
  }
  return children;
}
