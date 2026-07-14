export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getRequestsForCompany } from "@/lib/data";
import { ClientRequestsList } from "@/components/ClientRequestsList";
import { NewRequestModal } from "@/components/NewRequestModal";

export default async function ClientRequestsPage() {
  const session = await auth();
  const user = session!.user;
  const myRequests = user.companyId
    ? await getRequestsForCompany(user.companyId)
    : [];

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Requerimentos</h1>
          <p className="text-slate-500 text-sm mt-1">
            Pedidos de orçamento, informações e reclamações
          </p>
        </div>
        <NewRequestModal />
      </div>

      <ClientRequestsList requests={myRequests} />
    </>
  );
}