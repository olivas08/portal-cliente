export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRequestById, getAllRequests } from "@/lib/data";
import { PortalShell } from "@/components/PortalShell";
import {
  RequestStatusBadge,
  RequestTypeBadge,
} from "@/components/RequestBadges";
import { RequestStatusControl } from "@/components/RequestStatusControl";
import { MessageThread } from "@/components/MessageThread";
import { ReplyForm } from "@/components/ReplyForm";
import { RequestListPane } from "@/components/RequestListPane";

export default async function AdminRequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getRequestById(id);
  if (!request) notFound();

  const allRequests = await getAllRequests();

  return (
    <PortalShell requiredRole="ADMIN" breadcrumb={request.subject}>
      <Link
        href="/admin/requerimentos"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5 w-fit lg:hidden"
      >
        <ArrowLeft size={16} /> Voltar aos requerimentos
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="hidden lg:block lg:col-span-1">
          <RequestListPane
            requests={allRequests}
            basePath="/admin/requerimentos"
            activeId={request.id}
            showCompany
          />
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <p className="text-xs font-mono text-slate-400 mb-0.5">
                  {request.reference}
                </p>
                <h1 className="text-lg font-bold text-slate-800">
                  {request.subject}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {request.clientCompany} · Criado em {request.createdDate}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <RequestTypeBadge type={request.type} />
                <RequestStatusBadge status={request.status} />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <RequestStatusControl
                requestId={request.id}
                status={request.status}
              />
            </div>
          </div>

          <MessageThread messages={request.messages} perspective="admin" />

          {request.status !== "closed" ? (
            <ReplyForm
              requestId={request.id}
              placeholder="Escreva a resposta ao cliente..."
              buttonLabel="Responder"
            />
          ) : (
            <p className="text-center text-sm text-slate-400 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              Requerimento fechado. Altere o estado para reabrir.
            </p>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
