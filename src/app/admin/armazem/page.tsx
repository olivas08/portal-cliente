export const dynamic = "force-dynamic";

import {
  getMaterials,
  getWorkOrdersAwaitingMaterials,
  getRecentStockMovements,
} from "@/lib/data";
import { WarehouseView } from "@/components/WarehouseView";

export default async function AdminWarehousePage() {
  const [materials, awaiting, movements] = await Promise.all([
    getMaterials(),
    getWorkOrdersAwaitingMaterials(),
    getRecentStockMovements(),
  ]);
  return (
    <WarehouseView
      materials={materials}
      awaiting={awaiting}
      movements={movements}
    />
  );
}
