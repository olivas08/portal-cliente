export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAllOrders, getCompanies } from "@/lib/data";
import { AdminOrdersView } from "@/components/AdminOrdersView";
import { isAdminRole, roleHasArea, ROLE_DEFAULT_PATH } from "@/lib/roles";

export default async function AdminDashboardPage() {
  const session = await auth();
  const role = session?.user?.role;
  // Roles without access to Produção have no business on the orders board —
  // send them to their own area's landing page instead.
  if (role && isAdminRole(role) && !roleHasArea(role, "producao")) {
    redirect(ROLE_DEFAULT_PATH[role]);
  }

  const [orders, companies] = await Promise.all([
    getAllOrders(),
    getCompanies(),
  ]);

  return (
    <AdminOrdersView
      orders={orders}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}