import { NextResponse } from "next/server";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";

export const dynamic = "force-dynamic";

/**
 * Test-only escape hatch: flushes every `unstable_cache` tag immediately.
 *
 * Why this exists: the Data Cache uses `revalidate: false` everywhere (see
 * src/lib/data.ts) — entries never expire on their own, only via
 * `revalidateTag`/`invalidateCache` calls from the app's own mutations. The
 * E2E test-seed script (prisma/seed.ts, invoked from e2e/global-setup.ts)
 * reseeds the DB directly with Prisma, bypassing the app entirely, so a
 * long-lived `npm run dev` server (Playwright's `reuseExistingServer`) keeps
 * serving cached data from before the reseed. This route lets global setup
 * flush the cache over HTTP after reseeding, without needing a real request
 * context to call `revalidateTag` from a bare script.
 *
 * Hard-blocked outside development / E2E so it can never be hit in a
 * deployed environment. CI Playwright serves `next start` (NODE_ENV=
 * production) with E2E_TEST set, and still needs this flush after seeding.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production" && process.env.E2E_TEST !== "true") {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  for (const tag of Object.values(CACHE_TAGS)) {
    invalidateCache(tag);
  }

  return NextResponse.json({ ok: true });
}
