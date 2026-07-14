export const dynamic = "force-dynamic";

import { getAllRequests, getCompanies } from "@/lib/data";
import { AdminRequestsView } from "@/components/AdminRequestsView";

export default async function AdminRequestsPage() {
  const [requests, companies] = await Promise.all([
    getAllRequests(),
    getCompanies(),
  ]);

  return (
    <AdminRequestsView
      requests={requests}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}