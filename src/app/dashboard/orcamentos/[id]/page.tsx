export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getQuoteById } from "@/lib/data";
import { QuoteDetail } from "@/components/QuoteDetail";

export default async function ClientQuoteDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;

  const quote = await getQuoteById(id);
  if (!quote || quote.status === "draft") notFound();
  if (quote.companyId !== user.companyId) redirect("/dashboard/orcamentos");

  return <QuoteDetail quote={quote} isAdmin={false} />;
}
