export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getQuoteById } from "@/lib/data";
import { QuoteDetail } from "@/components/QuoteDetail";

export default async function AdminQuoteDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) notFound();

  return <QuoteDetail quote={quote} isAdmin />;
}
