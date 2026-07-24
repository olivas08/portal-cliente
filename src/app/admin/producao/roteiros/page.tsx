export const dynamic = "force-dynamic";

import { getProductsWithRouting, getWorkstationOptions } from "@/lib/data";
import { RoutingManager } from "@/components/RoutingManager";

export default async function AdminRoutingPage() {
  const [products, workstations] = await Promise.all([
    getProductsWithRouting(),
    getWorkstationOptions(),
  ]);

  return <RoutingManager products={products} workstations={workstations} />;
}
