export const dynamic = "force-dynamic";

import { getWorkstationOee, getFactoryOee } from "@/lib/data";
import { WorkstationOeeView } from "@/components/WorkstationOeeView";

export default async function AdminOeePage() {
  const [stations, factory] = await Promise.all([
    getWorkstationOee(),
    getFactoryOee(),
  ]);
  return <WorkstationOeeView stations={stations} factory={factory} />;
}
