export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getOrderById } from "@/lib/data";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { StatusStepper } from "@/components/StatusStepper";
import { OrderItemsTable } from "@/components/OrderItemsTable";
import { OrderDocumentsCards } from "@/components/OrderDocuments";
import { OrderAttachments } from "@/components/OrderAttachments";
import { DatesCard } from "@/components/DatesCard";

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
    <>
      <BreadcrumbSetter text={order.reference} />
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5 w-fit"
      >
        <ArrowLeft size={16} /> Voltar às encomendas
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
            <p className="text-sm text-slate-400 mt-1">
              Lote: {order.batchNumber}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <StatusStepper status={order.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <OrderItemsTable order={order} />
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
            currentUserId={user.id}
            isAdmin={false}
          />
        </div>
      </div>
    </>
  );
}
