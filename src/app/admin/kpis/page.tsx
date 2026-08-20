export const dynamic = "force-dynamic";

import { getAllOrders, getProductionKpis, getFactoryOee } from "@/lib/data";
import { computeOrderKpis } from "@/lib/kpis";
import { AdminKpisView } from "@/components/AdminKpisView";

export default async function AdminKpisPage() {
  const [orders, production, factoryOee] = await Promise.all([
    getAllOrders(),
    getProductionKpis(),
    getFactoryOee(),
  ]);
  const kpis = computeOrderKpis(orders);

  return (
    <AdminKpisView
      kpis={kpis}
      production={production}
      factoryOee={factoryOee?.oee ?? null}
    />
  );
}
