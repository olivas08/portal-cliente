export const dynamic = "force-dynamic";

import { getAllQuotes, getCompanies } from "@/lib/data";
import { AdminQuotesView } from "@/components/AdminQuotesView";

export default async function AdminQuotesPage() {
  const [quotes, companies] = await Promise.all([getAllQuotes(), getCompanies()]);

  return (
    <AdminQuotesView
      quotes={quotes}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
