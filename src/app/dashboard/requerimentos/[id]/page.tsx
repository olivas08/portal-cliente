export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getRequestById, getRequestsForCompany } from "@/lib/data";
import { PortalShell } from "@/components/PortalShell";
import {
  RequestStatusBadge,
  RequestTypeBadge,
} from "@/components/RequestBadges";
import { MessageThread } from "@/components/MessageThread";
import { ReplyForm } from "@/components/ReplyForm";
import { RequestListPane } from "@/components/RequestListPane";

export default async function ClientRequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;

  const request = await getRequestById(id);
  if (!request) notFound();
  if (request.companyId !== user.companyId) redirect("/dashboard/requerimentos");

  const allRequests = user.companyId
    ? await getRequestsForCompany(user.companyId)
    : [];
  const isClosed = request.status === "closed";

  return (
    <PortalShell requiredRole="CLIENT" breadcrumb={request.subject}>
      <Link
        href="/dashboard/requerimentos"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5 w-fit lg:hidden"
      >
        <ArrowLeft size={16} /> Voltar aos requerimentos
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="hidden lg:block lg:col-span-1">
          <RequestListPane
            requests={allRequests}
            basePath="/dashboard/requerimentos"
            activeId={request.id}
          />
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-lg font-bold text-slate-800">
                  {request.subject}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Criado em {request.createdDate}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <RequestTypeBadge type={request.type} />
                <RequestStatusBadge status={request.status} />
              </div>
            </div>
          </div>

          <MessageThread messages={request.messages} perspective="client" />

          {!isClosed ? (
            <ReplyForm
              requestId={request.id}
              placeholder="Escreva a sua mensagem..."
              buttonLabel="Enviar"
            />
          ) : (
            <p className="text-center text-sm text-slate-400 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              Este requerimento está fechado.
            </p>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
