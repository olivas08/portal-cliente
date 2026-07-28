export const dynamic = "force-dynamic";

import {
  getMachinesWithStatus,
  getRecentDiscrepancies,
  getWorkstationOptions,
} from "@/lib/data";
import { MachinesView } from "@/components/MachinesView";

export default async function AdminMachinesPage() {
  const [machines, discrepancies, stations] = await Promise.all([
    getMachinesWithStatus(),
    getRecentDiscrepancies(),
    getWorkstationOptions(),
  ]);
  return (
    <MachinesView
      machines={machines}
      discrepancies={discrepancies}
      stations={stations}
    />
  );
}
