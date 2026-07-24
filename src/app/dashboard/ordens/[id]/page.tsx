export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrderById, getOrderProduction } from "@/lib/data";
import { OrderDetail } from "@/components/OrderDetail";

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

  const production = await getOrderProduction(id);

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
