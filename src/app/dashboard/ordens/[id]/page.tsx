export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getOrderById } from "@/lib/data";
import { PortalShell } from "@/components/PortalShell";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { StatusStepper } from "@/components/StatusStepper";
import { OrderItemsTable } from "@/components/OrderItemsTable";
import { OrderDocumentsCards } from "@/components/OrderDocuments";

export default async function ClientOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;

  const order = await getOrderById(id);
  if (!order) notFound();
  if (order.companyId !== user.companyId) redirect("/dashboard");

  return (
    <PortalShell requiredRole="CLIENT" breadcrumb={order.reference}>
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6 w-fit"
      >
        <ArrowLeft size={16} /> Voltar às encomendas
      </Link>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-800">
                {order.reference}
              </h1>
              {order.priority === "urgent" && (
                <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
                  Urgente
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Lote: {order.batchNumber}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <StatusStepper status={order.status} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400">Data da encomenda</p>
            <p className="text-sm font-medium text-slate-700 mt-0.5">
              {order.createdDate}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Prazo acordado</p>
            <p className="text-sm font-medium text-slate-700 mt-0.5">
              {order.expectedDate}
            </p>
          </div>
          {order.shippedDate && (
            <div>
              <p className="text-xs text-slate-400">Data de expedição</p>
              <p className="text-sm font-medium text-slate-700 mt-0.5">
                {order.shippedDate}
              </p>
            </div>
          )}
          {order.deliveredDate && (
            <div>
              <p className="text-xs text-slate-400">Data de entrega</p>
              <p className="text-sm font-medium text-green-600 mt-0.5">
                {order.deliveredDate}
              </p>
            </div>
          )}
        </div>
      </div>

      <OrderItemsTable order={order} />

      {order.observations && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
          <h2 className="font-semibold text-slate-800 mb-1">Observações</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {order.observations}
          </p>
        </div>
      )}

      <OrderDocumentsCards order={order} />
    </PortalShell>
  );
}