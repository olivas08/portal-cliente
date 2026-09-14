export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth-guard";
import { getQuoteById } from "@/lib/data";
import { QuoteDetail } from "@/components/QuoteDetail";

export default async function ClientQuoteDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSessionUser();
  if (!user.companyId) redirect("/dashboard/orcamentos");

  const quote = await getQuoteById(id, user.companyId);
  if (!quote || quote.status === "draft") notFound();

  return <QuoteDetail quote={quote} isAdmin={false} />;
}
