export const dynamic = "force-dynamic";

import { getClientCompanies } from "@/lib/data";
import { onboardClientCompanyAction, inviteClientUserAction } from "@/actions/clients";
import { AdminClientsView } from "@/components/AdminClientsView";

export default async function AdminClientsPage() {
  const companies = await getClientCompanies();

  return (
    <AdminClientsView
      companies={companies}
      onOnboard={onboardClientCompanyAction}
      onInviteUser={inviteClientUserAction}
    />
  );
}
