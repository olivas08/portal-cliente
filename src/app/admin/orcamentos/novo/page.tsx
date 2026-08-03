export const dynamic = "force-dynamic";

import { getCompanies, getPricingSettingsVM, getOperationTypesVM } from "@/lib/data";
import { QuoteBuilder } from "@/components/QuoteBuilder";

export default async function NewQuotePage() {
  const [companies, pricing, operationTypes] = await Promise.all([
    getCompanies(),
    getPricingSettingsVM(),
    getOperationTypesVM(),
  ]);

  return (
    <QuoteBuilder
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      pricing={pricing}
      operationTypes={operationTypes}
    />
  );
}
