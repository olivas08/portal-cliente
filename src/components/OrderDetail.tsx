import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { OrderVM } from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { StatusStepper } from "@/components/StatusStepper";
import { OrderStatusControl } from "@/components/OrderStatusControl";
import { OrderItemsTable } from "@/components/OrderItemsTable";
import { OrderDocumentsCards } from "@/components/OrderDocuments";
import { OrderAttachments } from "@/components/OrderAttachments";
import { ReorderModal } from "@/components/ReorderModal";
import { DatesCard } from "@/components/DatesCard";

interface OrderDetailProps {
  order: OrderVM;
  currentUserId: string;
  isAdmin: boolean;
  backHref: string;
  backLabel: string;
}

/**
 * Shared order-detail view for both the admin and client routes. The pages
 * own the route concerns (auth, data fetching, company-scope redirect); this
 * component owns the presentation. Admin-only affordances (client name in the
 * header, the status control) are gated behind `isAdmin`.
 */
export function OrderDetail({
  order,
  currentUserId,
  isAdmin,
  backHref,
  backLabel,
}: OrderDetailProps) {
  return (
    <>
      <BreadcrumbSetter text={order.reference} />
      <Link
        href={backHref}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5 w-fit"
      >
        <ArrowLeft size={16} /> {backLabel}
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-800">
                {order.reference}
              </h1>
              {order.priority === "urgent" && (
                <span className="text-[10px] bg-amber-500 text-white font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
                  Urgente
                </span>
              )}
            </div>
            {isAdmin ? (
              <p className="text-sm text-slate-500 mt-1">
                Cliente:{" "}
                <span className="font-medium text-slate-700">
                  {order.clientCompany}
                </span>
                <span className="mx-2 text-slate-200">|</span>
                Lote:{" "}
                <span className="font-medium text-slate-700">
                  {order.batchNumber ?? "A atribuir"}
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-400 mt-1">
                Lote: {order.batchNumber ?? "A atribuir"}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-3">
            <OrderStatusBadge status={order.status} />
            {!isAdmin && <ReorderModal order={order} />}
          </div>
        </div>

        <StatusStepper status={order.status} />
      </div>

      {isAdmin && (
        <OrderStatusControl orderId={order.id} status={order.status} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <OrderItemsTable
            order={order}
            title={isAdmin ? "Artigos da Encomenda" : undefined}
          />
          {order.observations && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <h2 className="font-semibold text-slate-800 mb-1">Observações</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {order.observations}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <DatesCard order={order} />
          <OrderDocumentsCards order={order} />
          <OrderAttachments
            orderId={order.id}
            attachments={order.attachments}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </>
  );
}
