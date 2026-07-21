import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import type { RequestVM, RequestSummaryVM } from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import {
  RequestStatusBadge,
  RequestTypeBadge,
} from "@/components/RequestBadges";
import { RequestStatusControl } from "@/components/RequestStatusControl";
import { MessageThread } from "@/components/MessageThread";
import { ReplyForm } from "@/components/ReplyForm";
import { RequestListPane } from "@/components/RequestListPane";

interface RequestDetailProps {
  request: RequestVM;
  requests: RequestSummaryVM[];
  isAdmin: boolean;
}

/**
 * Shared request-detail view for the admin and client routes. Pages own the
 * route concerns (auth, data fetching, company-scope redirect); this component
 * owns the presentation. Copy and admin-only affordances (client name, status
 * control) are derived from `isAdmin` so the two routes can't drift apart.
 */
export function RequestDetail({ request, requests, isAdmin }: RequestDetailProps) {
  const basePath = isAdmin ? "/admin/requerimentos" : "/dashboard/requerimentos";
  const isClosed = request.status === "closed";

  return (
    <>
      <BreadcrumbSetter text={request.subject} />
      <Link
        href={basePath}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5 w-fit lg:hidden"
      >
        <ArrowLeft size={16} /> Voltar aos requerimentos
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="hidden lg:block lg:col-span-1">
          <RequestListPane
            requests={requests}
            basePath={basePath}
            activeId={request.id}
            showCompany={isAdmin}
          />
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
            <div
              className={`flex items-start justify-between gap-4 flex-wrap ${
                isAdmin ? "mb-4" : ""
              }`}
            >
              <div>
                <p className="text-xs font-mono text-slate-400 mb-0.5">
                  {request.reference}
                </p>
                <h1 className="text-lg font-bold text-slate-800">
                  {request.subject}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {isAdmin ? `${request.clientCompany} · ` : ""}Criado em{" "}
                  {request.createdDate}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <RequestTypeBadge type={request.type} />
                <RequestStatusBadge status={request.status} />
                <Link
                  href={basePath}
                  title="Fechar"
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={16} />
                </Link>
              </div>
            </div>

            {isAdmin && (
              <div className="border-t border-slate-100 pt-4">
                <RequestStatusControl
                  requestId={request.id}
                  status={request.status}
                />
              </div>
            )}
          </div>

          <MessageThread
            messages={request.messages}
            perspective={isAdmin ? "admin" : "client"}
          />

          {!isClosed ? (
            <ReplyForm
              requestId={request.id}
              placeholder={
                isAdmin
                  ? "Escreva a resposta ao cliente..."
                  : "Escreva a sua mensagem..."
              }
              buttonLabel={isAdmin ? "Responder" : "Enviar"}
            />
          ) : (
            <p className="text-center text-sm text-slate-400 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              {isAdmin
                ? "Requerimento fechado. Altere o estado para reabrir."
                : "Este requerimento está fechado."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
