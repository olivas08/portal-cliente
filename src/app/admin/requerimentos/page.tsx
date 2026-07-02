export const dynamic = "force-dynamic";

import { getAllRequests, getCompanies } from "@/lib/data";
import { PortalShell } from "@/components/PortalShell";
import { AdminRequestsView } from "@/components/AdminRequestsView";

export default async function AdminRequestsPage() {
  const [requests, companies] = await Promise.all([
    getAllRequests(),
    getCompanies(),
  ]);

  return (
    <PortalShell requiredRole="ADMIN">
      <AdminRequestsView
        requests={requests}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
    </PortalShell>
  );
}