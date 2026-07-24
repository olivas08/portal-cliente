export const dynamic = "force-dynamic";

import { getWorkstationLoad } from "@/lib/data";
import { WorkstationCapacity } from "@/components/WorkstationCapacity";

export default async function AdminCapacityPage() {
  const load = await getWorkstationLoad();
  return <WorkstationCapacity load={load} />;
}
