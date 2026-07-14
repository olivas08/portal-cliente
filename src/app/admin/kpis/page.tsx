export const dynamic = "force-dynamic";

import { getAllOrders } from "@/lib/data";
import { computeOrderKpis } from "@/lib/kpis";
import { AdminKpisView } from "@/components/AdminKpisView";

export default async function AdminKpisPage() {
  const orders = await getAllOrders();
  const kpis = computeOrderKpis(orders);

  return <AdminKpisView kpis={kpis} />;
}
