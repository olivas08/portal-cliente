import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  machineIngestSchema,
  machineStatusSchema,
  recordMachineProduction,
  recordMachineStatus,
} from "@/services/production/machines.service";
import { RateLimitedError, UnauthorizedError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Machine-to-cloud ingestion endpoint. The edge gateway POSTs here:
 *  - production pulses (goodDelta/scrapDelta, idempotent per eventId), or
 *  - state transitions ({ state: "run"|"idle"|"down"|"offline" }).
 * Kept as HTTP because the app is serverless — MQTT lives inside the factory
 * edge network, the edge forwards over HTTPS with per-device token auth.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const isStatus =
    typeof body === "object" && body !== null && "state" in body;

  try {
    if (isStatus) {
      const input = machineStatusSchema.parse(body);
      const result = await recordMachineStatus(input);
      return NextResponse.json({ ok: true, ...result });
    }
    const input = machineIngestSchema.parse(body);
    const result = await recordMachineProduction(input);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Payload inválido.", issues: err.issues },
        { status: 400 },
      );
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof RateLimitedError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("machine ingest error", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
