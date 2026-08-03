export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getQuoteById, getCompanies, getPricingSettingsVM } from "@/lib/data";
import { QuoteBuilder } from "@/components/QuoteBuilder";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quote, companies, pricing] = await Promise.all([
    getQuoteById(id),
    getCompanies(),
    getPricingSettingsVM(),
  ]);
  if (!quote || quote.status !== "draft") notFound();

  return (
    <QuoteBuilder
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      pricing={pricing}
      quote={quote}
    />
  );
}
