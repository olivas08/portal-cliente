export const dynamic = "force-dynamic";

import { getCompanies, getPricingSettingsVM } from "@/lib/data";
import { QuoteBuilder } from "@/components/QuoteBuilder";

export default async function NewQuotePage() {
  const [companies, pricing] = await Promise.all([
    getCompanies(),
    getPricingSettingsVM(),
  ]);

  return (
    <QuoteBuilder
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      pricing={pricing}
    />
  );
}
