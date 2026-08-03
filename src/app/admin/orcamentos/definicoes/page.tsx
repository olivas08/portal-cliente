export const dynamic = "force-dynamic";

import { getPricingSettingsVM } from "@/lib/data";
import { PricingSettingsForm } from "@/components/PricingSettingsForm";

export default async function PricingSettingsPage() {
  const pricing = await getPricingSettingsVM();

  return <PricingSettingsForm pricing={pricing} />;
}
