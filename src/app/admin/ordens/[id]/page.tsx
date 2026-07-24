export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getOrderById, getOrderProduction } from "@/lib/data";
import { OrderDetail } from "@/components/OrderDetail";

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const order = await getOrderById(id);
  if (!order) notFound();

  const production = await getOrderProduction(id);

  return (
    <OrderDetail
      order={order}
      currentUserId={session!.user.id}
      isAdmin
      backHref="/admin"
      backLabel="Voltar ao painel"
      production={production}
    />
  );
}
