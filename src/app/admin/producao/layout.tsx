import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminRole, roleHasArea } from "@/lib/roles";

/**
 * Read-access gate for the whole "Produção / Qualidade" section (covers every nested
 * route). The real enforcement for writes lives in the corresponding
 * requireAdminArea() calls in src/actions/*.ts — this is a defense-in-depth
 * / UX guard so a role without this area doesn't even see the pages.
 */
export default async function ProducaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !isAdminRole(role) || (!roleHasArea(role, "producao") && !roleHasArea(role, "qualidade"))) {
    redirect("/admin");
  }
  return children;
}
