export const dynamic = "force-dynamic";

import { getAllOrders, getCompanies } from "@/lib/data";
import { PortalShell } from "@/components/PortalShell";
import { AdminOrdersView } from "@/components/AdminOrdersView";

export default async function AdminDashboardPage() {
  const [orders, companies] = await Promise.all([
    getAllOrders(),
    getCompanies(),
  ]);

  return (
    <PortalShell requiredRole="ADMIN">
      <AdminOrdersView
        orders={orders}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
    </PortalShell>
  );
}