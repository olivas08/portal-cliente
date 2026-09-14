export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth-guard";
import { getOrderById, getOrderProduction } from "@/lib/data";
import { OrderDetail } from "@/components/OrderDetail";

export default async function ClientOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSessionUser();
  if (!user.companyId) redirect("/dashboard");

  const order = await getOrderById(id, user.companyId);
  if (!order) notFound();

  const production = await getOrderProduction(id, user.companyId);

  return (
    <OrderDetail
      order={order}
      currentUserId={user.id}
      isAdmin={false}
      backHref="/dashboard"
      backLabel="Voltar às encomendas"
      production={production}
    />
  );
}
