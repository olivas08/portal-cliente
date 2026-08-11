export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAdminUsers, inviteAdminUser, setAdminUserActive } from "@/actions/admin-users";
import { UsersManagementView } from "@/components/UsersManagementView";
import { ADMIN_ROLES, type AdminRole } from "@/lib/roles";

export default async function AdminUsersPage() {
  const session = await auth();
  const user = session?.user;
  // Only the super-admin manages factory-side accounts.
  if (!user || user.role !== "ADMIN") redirect("/admin");

  const users = await listAdminUsers();

  async function handleInvite(input: { name: string; email: string; role?: AdminRole }) {
    "use server";
    if (!input.role) {
      return { ok: false as const, error: "Selecione uma função." };
    }
    return inviteAdminUser({ name: input.name, email: input.email, role: input.role });
  }

  return (
    <UsersManagementView
      title="Utilizadores"
      subtitle="Contas da equipa, com acesso limitado à sua área"
      currentUserId={user.id}
      users={users}
      roleOptions={[...ADMIN_ROLES]}
      onInvite={handleInvite}
      onToggleActive={setAdminUserActive}
    />
  );
}
