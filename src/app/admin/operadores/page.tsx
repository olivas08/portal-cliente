export const dynamic = "force-dynamic";

import { getOperatorsWithStats } from "@/lib/data";
import { OperatorsView } from "@/components/OperatorsView";

export default async function AdminOperatorsPage() {
  const operators = await getOperatorsWithStats();
  return <OperatorsView operators={operators} />;
}
