/**
 * Central registry of cache tags used with `unstable_cache` (data readers in
 * src/lib/data.ts) and `revalidateTag` (mutation call sites in
 * src/services/*.ts and src/actions/*.ts). Keeping these as named constants
 * avoids a typo silently breaking invalidation (a cached getter that never
 * gets refreshed after a write).
 *
 * Tags are intentionally coarse (one per Prisma model family, not per
 * query) — over-invalidating is always safe (just an extra DB round trip),
 * under-invalidating shows stale data. Mutations should tag every model they
 * write to, even if a given cached getter doesn't use every field.
 */
import { revalidateTag } from "next/cache";

export const CACHE_TAGS = {
  workOrders: "work-orders",
  machines: "machines",
  nonConformities: "non-conformities",
  materials: "materials",
  products: "products",
  companies: "companies",
  operators: "operators",
  routing: "routing",
  workstations: "workstations",
  pricingSettings: "pricing-settings",
  operationTypes: "operation-types",
  maintenance: "maintenance",
  invoices: "invoices",
  orders: "orders",
  quotes: "quotes",
  requests: "requests",
  notifications: "notifications",
} as const;

/**
 * Invalidates a cache tag with immediate expiration semantics. In this
 * Next.js version, `revalidateTag(tag)` with a single argument is deprecated
 * and — when a profile is provided — defaults to stale-while-revalidate
 * ("max") behaviour, which can keep serving stale data until the next
 * visit. We pass `{ expire: 0 }` instead so every write is reflected
 * immediately on the next read, since several call sites (e.g. the machine
 * ingest Route Handler) aren't Server Actions and can't use `updateTag`.
 */
export function invalidateCache(tag: string): void {
  revalidateTag(tag, { expire: 0 });
}

