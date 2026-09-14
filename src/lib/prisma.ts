import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Fail in ~10s on Vercel instead of hanging until the 300s function timeout. */
function withTimeouts(url: string | undefined): string | undefined {
  if (!url || /[?&]connect_timeout=/i.test(url)) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}connect_timeout=10&pool_timeout=10`;
}

const datasourceUrl = withTimeouts(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
