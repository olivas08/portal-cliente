export const dynamic = "force-dynamic";

import Link from "next/link";
import { Package, Loader, CheckCircle, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { getOrdersForCompany } from "@/lib/data";
import { PortalShell } from "@/components/PortalShell";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;
  const myOrders = user.companyId
    ? await getOrdersForCompany(user.companyId)
    : [];

  const inProgress = myOrders.filter((o) => o.status !== "delivered").length;
  const delivered = myOrders.filter((o) => o.status === "delivered").length;
  const urgent = myOrders.filter((o) => o.priority === "urgent").length;

  const stats = [
    {
      label: "Total Encomendas",
      value: myOrders.length,
      icon: Package,
      chip: "bg-brand text-white",
      foot: "Registadas no portal",
    },
    {
      label: "Em Curso",
      value: inProgress,
      icon: Loader,
      chip: "bg-amber-100 text-amber-700",
      foot: urgent > 0 ? `${urgent} urgente${urgent > 1 ? "s" : ""}` : "A decorrer",
    },
    {
      label: "Entregues",
      value: delivered,
      icon: CheckCircle,
      chip: "bg-teal-100 text-teal-700",
      foot: "Concluídas",
    },
  ];

  return (
    <PortalShell requiredRole="CLIENT">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          Bem-vindo, {user.name}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Acompanhe o estado das suas encomendas
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, chip, foot }) => (
          <div
            key={label}
            className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow last:col-span-2 sm:last:col-span-1"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                {label}
              </p>
              <span className={`p-1.5 rounded-lg ${chip}`}>
                <Icon size={15} />
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
              {foot}
            </p>
          </div>
        ))}
      </div>

      {urgent > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium">
          ⚡ Tem {urgent} encomenda{urgent > 1 ? "s" : ""} com prioridade urgente
          em curso.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">As Minhas Encomendas</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {myOrders.map((order) => {
            const isUrgent = order.priority === "urgent";
            return (
              <Link
                key={order.id}
                href={`/dashboard/ordens/${order.id}`}
                className={`flex items-center gap-4 px-5 py-4 border-l-4 hover:bg-slate-50 transition-colors ${
                  isUrgent
                    ? "border-l-amber-500 bg-amber-50/40"
                    : "border-l-transparent"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">
                      {order.reference}
                    </p>
                    {isUrgent && (
                      <span className="text-[10px] bg-amber-500 text-white font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
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
                <ChevronRight
                  size={16}
                  className="text-slate-300 flex-shrink-0 hidden sm:block"
                />
              </Link>
            );
          })}

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
