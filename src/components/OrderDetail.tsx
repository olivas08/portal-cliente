import Link from "next/link";
import { ArrowLeft, Ban } from "lucide-react";
import type { OrderVM } from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { StatusStepper } from "@/components/StatusStepper";
import { OrderStatusControl } from "@/components/OrderStatusControl";
import { OrderCancelControl } from "@/components/OrderCancelControl";
import { OrderItemsTable } from "@/components/OrderItemsTable";
import { OrderDocumentsCards } from "@/components/OrderDocuments";
import { OrderAttachments } from "@/components/OrderAttachments";
import { ReorderModal } from "@/components/ReorderModal";
import { DatesCard } from "@/components/DatesCard";
import { ProductionProgress } from "@/components/ProductionProgress";
import type { OrderProductionVM } from "@/lib/types";

interface OrderDetailProps {
  order: OrderVM;
  currentUserId: string;
  isAdmin: boolean;
  backHref: string;
  backLabel: string;
  production?: OrderProductionVM | null;
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
  production,
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
            {!isAdmin && order.status !== "cancelled" && (
              <ReorderModal order={order} />
            )}
          </div>
        </div>

        {order.status === "cancelled" ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <Ban size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">
                Encomenda cancelada
              </p>
              {order.cancelReason && (
                <p className="text-sm text-red-600 mt-0.5 whitespace-pre-wrap">
                  {order.cancelReason}
                </p>
              )}
            </div>
          </div>
        ) : (
          <StatusStepper status={order.status} />
        )}
      </div>

      {production && order.status !== "cancelled" && (
        <ProductionProgress production={production} />
      )}

      {isAdmin && order.status !== "cancelled" && (
        <OrderStatusControl orderId={order.id} status={order.status} />
      )}

      <OrderCancelControl
        orderId={order.id}
        status={order.status}
        isAdmin={isAdmin}
      />

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
