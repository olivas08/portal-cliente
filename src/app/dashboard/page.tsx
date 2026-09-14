export const dynamic = "force-dynamic";

import { Package, Loader, CheckCircle } from "lucide-react";
import { requireSessionUser } from "@/lib/auth-guard";
import { getOrdersForCompany } from "@/lib/data";
import { ClientOrdersList } from "@/components/ClientOrdersList";

export default async function DashboardPage() {
  const user = await requireSessionUser();
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
    <>
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

      <ClientOrdersList orders={myOrders} />
    </>
  );
}
