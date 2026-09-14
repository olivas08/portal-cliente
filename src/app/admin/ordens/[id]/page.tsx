export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireSessionUser } from "@/lib/auth-guard";
import {
  getOrderById,
  getOrderProduction,
  getOrderTraceability,
  getInvoiceForOrder,
} from "@/lib/data";
import { OrderDetail } from "@/components/OrderDetail";

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSessionUser();
  const order = await getOrderById(id);
  if (!order) notFound();

  const [production, traceability, invoice] = await Promise.all([
    getOrderProduction(id),
    getOrderTraceability(id),
    getInvoiceForOrder(id),
  ]);

  return (
    <OrderDetail
      order={order}
      currentUserId={user.id}
      isAdmin
      backHref="/admin"
      backLabel="Voltar ao painel"
      production={production}
      traceability={traceability}
      invoice={invoice}
    />
  );
}
