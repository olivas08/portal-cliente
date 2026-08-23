import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for uptime monitors (e.g. UptimeRobot).
 * Public, unauthenticated — returns 503 when the database is unreachable.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, checks: { database: "ok" } },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, checks: { database: "error" } },
      { status: 503 },
    );
  }
}
