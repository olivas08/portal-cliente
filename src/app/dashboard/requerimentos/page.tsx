export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/auth";
import { getRequestsForCompany } from "@/lib/data";
import {
  RequestStatusBadge,
  RequestTypeBadge,
} from "@/components/RequestBadges";
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

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {myRequests.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/requerimentos/${r.id}`}
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-slate-400 flex-shrink-0">
                    {r.reference}
                  </span>
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {r.subject}
                  </p>
                  {r.messages[r.messages.length - 1]?.from === "admin" && (
                    <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                      Nova resposta
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {r.createdDate} · {r.messages.length} mensagem
                  {r.messages.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <RequestTypeBadge type={r.type} />
                <RequestStatusBadge status={r.status} />
              </div>
            </Link>
          ))}
          {myRequests.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-10">
              Sem requerimentos. Clique em &quot;Novo Requerimento&quot; para
              começar.
            </p>
          )}
        </div>
      </div>
    </>
  );
}