export const dynamic = "force-dynamic";

import { getWorkOrders, getOrdersWithoutProduction } from "@/lib/data";
import { AdminProductionBoard } from "@/components/AdminProductionBoard";

export default async function AdminProductionPage() {
  const [workOrders, unplanned] = await Promise.all([
    getWorkOrders(),
    getOrdersWithoutProduction(),
  ]);

  return <AdminProductionBoard workOrders={workOrders} unplanned={unplanned} />;
}
