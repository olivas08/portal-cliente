export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getQuotesForCompany } from "@/lib/data";
import { ClientQuotesList } from "@/components/ClientQuotesList";

export default async function ClientQuotesPage() {
  const session = await auth();
  const companyId = session?.user?.companyId;
  if (!companyId) redirect("/login");

  const quotes = await getQuotesForCompany(companyId);

  return <ClientQuotesList quotes={quotes} />;
}
