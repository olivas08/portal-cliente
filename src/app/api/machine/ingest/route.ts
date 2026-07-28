import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  machineIngestSchema,
  recordMachineProduction,
} from "@/services/production.service";
import { UnauthorizedError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Machine-to-cloud ingestion endpoint. The edge gateway POSTs aggregated
 * production pulses here (device token auth, idempotent per eventId). Kept as
 * an HTTP endpoint because the app runs on serverless — no persistent MQTT
 * connection is held in the cloud; MQTT lives inside the factory edge network.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
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
    console.error("machine ingest error", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
