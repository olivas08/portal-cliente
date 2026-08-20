export const dynamic = "force-dynamic";

import { getProductionSchedule } from "@/lib/data";
import { ProductionSchedule } from "@/components/ProductionSchedule";

const HORIZON_DAYS = 14;

export default async function AdminSchedulePage() {
  const schedule = await getProductionSchedule(HORIZON_DAYS);
  return <ProductionSchedule schedule={schedule} horizonDays={HORIZON_DAYS} />;
}
