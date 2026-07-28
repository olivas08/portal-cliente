// Edge gateway: subscribes to machine pulses over MQTT and forwards them to the
// OIC cloud portal over HTTPS (POST /api/machine/ingest). Includes a durable
// store-and-forward buffer so no production is lost when the internet drops.
//
// Machine -> MQTT (in-factory) -> [this gateway] -> HTTPS -> cloud
import { readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import mqtt from "mqtt";

export function startGateway({
  brokerUrl = process.env.BROKER_URL ?? "mqtt://localhost:1883",
  cloudUrl = process.env.CLOUD_URL ?? "http://localhost:3000",
  machinesPath = new URL("./machines.json", import.meta.url),
  bufferPath = new URL("./.buffer.jsonl", import.meta.url),
} = {}) {
  const machines = JSON.parse(readFileSync(machinesPath, "utf8"));
  const ingestUrl = `${cloudUrl.replace(/\/$/, "")}/api/machine/ingest`;

  // Load any buffered (undelivered) pulses from a previous run.
  let queue = [];
  if (existsSync(bufferPath)) {
    queue = readFileSync(bufferPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    if (queue.length) console.log(`[gateway] restored ${queue.length} buffered pulses`);
  }

  const persist = () =>
    writeFileSync(bufferPath, queue.map((p) => JSON.stringify(p)).join("\n") + (queue.length ? "\n" : ""));

  const enqueue = (pulse) => {
    queue.push(pulse);
    appendFileSync(bufferPath, JSON.stringify(pulse) + "\n");
  };

  let flushing = false;
  async function flush() {
    if (flushing || queue.length === 0) return;
    flushing = true;
    try {
      while (queue.length) {
        const pulse = queue[0];
        let res;
        try {
          res = await fetch(ingestUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pulse),
          });
        } catch {
          console.log(`[gateway] cloud unreachable — ${queue.length} pulse(s) buffered`);
          break; // keep the queue, retry next tick
        }
        if (res.status >= 500) {
          console.log(`[gateway] cloud ${res.status} — will retry`);
          break;
        }
        // 2xx (accepted/deduped) or 4xx (permanent reject): drop from queue.
        if (!res.ok) {
          console.warn(`[gateway] pulse rejected (${res.status}) — dropping`, pulse.eventId);
        } else {
          const body = await res.json().catch(() => ({}));
          console.log(
            `[gateway] -> ${pulse.machineCode} good+${pulse.goodDelta} scrap+${pulse.scrapDelta} ` +
              `(machineQty=${body.machineQty ?? "?"}${body.deduped ? ", deduped" : ""})`,
          );
        }
        queue.shift();
        persist();
      }
    } finally {
      flushing = false;
    }
  }

  const client = mqtt.connect(brokerUrl);
  client.on("connect", () => {
    console.log(`[gateway] connected to broker ${brokerUrl}, forwarding to ${ingestUrl}`);
    client.subscribe("factory/+/pulse");
  });

  client.on("message", (topic, payload) => {
    const code = topic.split("/")[1];
    const cfg = machines[code];
    if (!cfg) {
      console.warn(`[gateway] unknown machine ${code} — ignoring`);
      return;
    }
    let data;
    try {
      data = JSON.parse(payload.toString());
    } catch {
      console.warn(`[gateway] bad payload on ${topic}`);
      return;
    }
    enqueue({
      machineCode: code,
      token: cfg.token,
      eventId: data.eventId ?? randomUUID(),
      goodDelta: data.goodDelta ?? 0,
      scrapDelta: data.scrapDelta ?? 0,
      producedAt: data.ts ?? new Date().toISOString(),
    });
    flush();
  });

  const timer = setInterval(flush, 2000);
  return { client, stop: () => { clearInterval(timer); client.end(); } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startGateway();
}
