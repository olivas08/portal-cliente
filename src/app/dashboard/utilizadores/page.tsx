export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCompanyUsers, inviteCompanyUser, setCompanyUserActive } from "@/actions/company-users";
import { UsersManagementView } from "@/components/UsersManagementView";

export default async function CompanyUsersPage() {
  const session = await auth();
  const user = session?.user;
  // Only the company admin manages their own company's accounts.
  if (!user || user.role !== "CLIENT") redirect("/dashboard");

  const users = await listCompanyUsers();

  return (
    <UsersManagementView
      title="Utilizadores"
      subtitle="Contas dos colaboradores da sua empresa neste portal"
      currentUserId={user.id}
      users={users}
      onInvite={inviteCompanyUser}
      onToggleActive={setCompanyUserActive}
    />
  );
}
