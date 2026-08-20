export const dynamic = "force-dynamic";

import {
  getMaintenancePlans,
  getMaintenanceTasks,
  getMachinesWithStatus,
} from "@/lib/data";
import { MaintenanceView } from "@/components/MaintenanceView";

export default async function AdminMaintenancePage() {
  const [plans, tasks, machines] = await Promise.all([
    getMaintenancePlans(),
    getMaintenanceTasks(),
    getMachinesWithStatus(),
  ]);
  return <MaintenanceView plans={plans} tasks={tasks} machines={machines} />;
}
