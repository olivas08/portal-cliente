export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRequestById } from "@/lib/data";
import { PortalShell } from "@/components/PortalShell";
import {
  RequestStatusBadge,
  RequestTypeBadge,
} from "@/components/RequestBadges";
import { RequestStatusControl } from "@/components/RequestStatusControl";
import { MessageThread } from "@/components/MessageThread";
import { ReplyForm } from "@/components/ReplyForm";

export default async function AdminRequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getRequestById(id);
  if (!request) notFound();

  return (
    <PortalShell requiredRole="ADMIN" breadcrumb={request.subject}>
      <Link
        href="/admin/requerimentos"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6 w-fit"
      >
        <ArrowLeft size={16} /> Voltar aos requerimentos
      </Link>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-5 border-2 border-slate-200">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
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

        <RequestStatusControl requestId={request.id} status={request.status} />
      </div>

      <MessageThread messages={request.messages} perspective="admin" />

      {request.status !== "closed" ? (
        <ReplyForm
          requestId={request.id}
          placeholder="Escreva a resposta ao cliente..."
          buttonLabel="Responder"
        />
      ) : (
        <p className="text-center text-sm text-slate-400 bg-white rounded-xl p-4 shadow-sm">
          Requerimento fechado. Altere o estado para reabrir.
        </p>
      )}
    </PortalShell>
  );
}