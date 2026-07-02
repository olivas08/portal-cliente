export const dynamic = "force-dynamic";

import Link from "next/link";
import { Package, Clock, CheckCircle, Truck } from "lucide-react";
import { auth } from "@/auth";
import { getOrdersForCompany } from "@/lib/data";
import { PortalShell } from "@/components/PortalShell";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import type { OrderStatus } from "@/lib/types";

const statusIcon: Record<OrderStatus, React.ReactNode> = {
  pending: <Clock size={16} className="text-slate-400" />,
  production: <Package size={16} className="text-blue-500" />,
  quality: <CheckCircle size={16} className="text-purple-500" />,
  shipped: <Truck size={16} className="text-amber-500" />,
  delivered: <CheckCircle size={16} className="text-green-500" />,
};

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;
  const myOrders = user.companyId
    ? await getOrdersForCompany(user.companyId)
    : [];

  const inProgress = myOrders.filter((o) => o.status !== "delivered").length;
  const delivered = myOrders.filter((o) => o.status === "delivered").length;
  const urgent = myOrders.filter((o) => o.priority === "urgent").length;

  return (
    <PortalShell requiredRole="CLIENT">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          Bem-vindo, {user.name}
        </h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            Total Encomendas
          </p>
          <p className="text-3xl font-bold text-slate-800 mt-2">
            {myOrders.length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            Em Curso
          </p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{inProgress}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            Entregues
          </p>
          <p className="text-3xl font-bold text-green-600 mt-2">{delivered}</p>
        </div>
      </div>

      {urgent > 0 && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 font-medium">
          ⚡ Tem {urgent} encomenda{urgent > 1 ? "s" : ""} com prioridade urgente
          em curso.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">As Minhas Encomendas</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {myOrders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/ordens/${order.id}`}
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex-shrink-0">{statusIcon[order.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">
                    {order.reference}
                  </p>
                  {order.priority === "urgent" && (
                    <span className="text-xs bg-orange-100 text-orange-700 font-medium px-2 py-0.5 rounded-full">
                      Urgente
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {order.items.length} artigo
                  {order.items.length !== 1 ? "s" : ""} · Prazo:{" "}
                  {order.expectedDate}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </Link>
          ))}

          {myOrders.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-10">
              Sem encomendas registadas.
            </p>
          )}
        </div>
      </div>
    </PortalShell>
  );
}