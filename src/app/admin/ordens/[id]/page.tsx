export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOrderById } from "@/lib/data";
import { PortalShell } from "@/components/PortalShell";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderStatusControl } from "@/components/OrderStatusControl";
import { OrderItemsTable } from "@/components/OrderItemsTable";
import { OrderDocumentsButtons } from "@/components/OrderDocuments";

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  return (
    <PortalShell requiredRole="ADMIN" breadcrumb={order.reference}>
      <Link
        href="/admin"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6 w-fit"
      >
        <ArrowLeft size={16} /> Voltar ao painel
      </Link>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
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
            <p className="text-sm text-slate-500 mt-1">
              Cliente:{" "}
              <span className="font-medium text-slate-700">
                {order.clientCompany}
              </span>
              <span className="mx-2 text-slate-200">|</span>
              Lote:{" "}
              <span className="font-medium text-slate-700">
                {order.batchNumber}
              </span>
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400">Encomenda criada</p>
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

      <OrderStatusControl orderId={order.id} status={order.status} />

      <OrderItemsTable order={order} title="Artigos da Encomenda" />

      {order.observations && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
          <h2 className="font-semibold text-slate-800 mb-1">Observações</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {order.observations}
          </p>
        </div>
      )}

      <OrderDocumentsButtons order={order} />
    </PortalShell>
  );
}