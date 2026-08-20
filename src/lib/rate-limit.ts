import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { RateLimitedError } from "@/lib/errors";

/**
 * DB-backed rate limiting. Deliberately NOT in-memory: Vercel serverless
 * functions don't share memory across invocations/instances, so a plain
 * counter would reset on every cold start and give no real protection.
 * The DB round-trip cost is negligible next to the auth work (bcrypt
 * compares, etc.) it's guarding.
 */

/** Best-effort client IP from the standard proxy headers Vercel sets. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

interface RateLimitOptions {
  /** Max attempts allowed within the window. */
  max: number;
  /** Sliding window size, in milliseconds. */
  windowMs: number;
}

/**
 * Records an attempt for `key` and reports whether it's within the allowed
 * rate. Call this BEFORE the guarded operation (e.g. before the bcrypt
 * compare) so blocked attempts don't pay that cost either.
 */
export async function checkRateLimit(
  key: string,
  { max, windowMs }: RateLimitOptions,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);

  const count = await prisma.rateLimitAttempt.count({
    where: { key, createdAt: { gt: since } },
  });
  if (count >= max) return false;

  await prisma.rateLimitAttempt.create({ data: { key } });

  // Opportunistic cleanup so the table doesn't grow unbounded — no cron
  // needed. Cheap enough to run on a small % of calls.
  if (Math.random() < 0.01) {
    const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.rateLimitAttempt.deleteMany({
      where: { createdAt: { lt: staleBefore } },
    });
  }

  return true;
}

/** Throws `RateLimitedError` (caught by `guardAction`) when over the limit. */
export async function assertRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<void> {
  const allowed = await checkRateLimit(key, options);
  if (!allowed) throw new RateLimitedError();
}
