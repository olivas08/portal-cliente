export const dynamic = "force-dynamic";

import { getPricingSettingsVM, getOperationTypesVM } from "@/lib/data";
import { PricingSettingsForm } from "@/components/PricingSettingsForm";

export default async function PricingSettingsPage() {
  const [pricing, operationTypes] = await Promise.all([
    getPricingSettingsVM(),
    getOperationTypesVM(),
  ]);

  return <PricingSettingsForm pricing={pricing} operationTypes={operationTypes} />;
}
