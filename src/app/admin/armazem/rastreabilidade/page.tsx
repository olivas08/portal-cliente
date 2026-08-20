export const dynamic = "force-dynamic";

import { findBatchTrace } from "@/lib/data";
import { RecallSearchView } from "@/components/RecallSearchView";

/**
 * Backward (recall) traceability search: given a batch/heat code, shows every
 * order it was consumed into, across every client. This is the "if this
 * delivery turns out to be defective, which customers were affected?" tool.
 */
export default async function RecallSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await findBatchTrace(query) : [];

  return <RecallSearchView query={query} results={results} />;
}
