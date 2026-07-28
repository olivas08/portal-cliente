// Edge gateway: bridges factory machines (MQTT, inside the OT network) to the
// OIC cloud portal (HTTPS POST /api/machine/ingest). Runs on a Raspberry Pi /
// industrial gateway.
//
//   Machine --MQTT--> [broker] --> [this gateway] --HTTPS--> cloud
//
// Handles three inbound message shapes on `factory/<CODE>/<kind>`:
//   pulse   {eventId?, goodDelta, scrapDelta, ts}   legacy per-part delta
//   counter {good, scrap, ts}                       CUMULATIVE totals (real PLCs)
//   state   {state, ts}                             run | idle | down | offline
//
// Production is batched per machine over a time window (one HTTPS call per
// window, not per part). State changes are forwarded immediately. A durable
// store-and-forward buffer means nothing is lost when the internet drops, and
// cumulative counters are persisted so a gateway restart doesn't double-count.
import {
  readFileSync,
  existsSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import mqtt from "mqtt";
import { computeDelta, WindowAggregator, windowEventId } from "./counter.mjs";

const VALID_STATES = new Set(["run", "idle", "down", "offline"]);

export function startGateway({
  brokerUrl = process.env.BROKER_URL ?? "mqtt://localhost:1883",
  cloudUrl = process.env.CLOUD_URL ?? "http://localhost:3000",
  username = process.env.EDGE_USER ?? "edge",
  password = process.env.EDGE_PASS ?? "edge-secret",
  windowMs = Number(process.env.WINDOW_MS ?? 5000),
  machinesPath = new URL("./machines.json", import.meta.url),
  bufferPath = new URL("./.buffer.jsonl", import.meta.url),
  countersPath = new URL("./.counters.json", import.meta.url),
} = {}) {
  const machines = JSON.parse(readFileSync(machinesPath, "utf8"));
  const ingestUrl = `${cloudUrl.replace(/\/$/, "")}/api/machine/ingest`;

  // --- durable store-and-forward buffer (survives internet drops) ---
  let queue = [];
  if (existsSync(bufferPath)) {
    queue = readFileSync(bufferPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    if (queue.length)
      console.log(`[gateway] restored ${queue.length} buffered event(s)`);
  }
  const persistQueue = () =>
    writeFileSync(
      bufferPath,
      queue.map((p) => JSON.stringify(p)).join("\n") + (queue.length ? "\n" : ""),
    );
  const enqueue = (evt) => {
    queue.push(evt);
    appendFileSync(bufferPath, JSON.stringify(evt) + "\n");
  };

  // --- cumulative counter memory (survives gateway restarts) ---
  let counters = existsSync(countersPath)
    ? JSON.parse(readFileSync(countersPath, "utf8"))
    : {};
  const persistCounters = () =>
    writeFileSync(countersPath, JSON.stringify(counters));

  const agg = new WindowAggregator();

  let flushing = false;
  async function flush() {
    if (flushing || queue.length === 0) return;
    flushing = true;
    try {
      while (queue.length) {
        const evt = queue[0];
        let res;
        try {
          res = await fetch(ingestUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(evt),
          });
        } catch {
          console.log(
            `[gateway] cloud unreachable — ${queue.length} event(s) buffered`,
          );
          break;
        }
        if (res.status >= 500) {
          console.log(`[gateway] cloud ${res.status} — will retry`);
          break;
        }
        if (!res.ok) {
          console.warn(
            `[gateway] event rejected (${res.status}) — dropping`,
            evt.eventId ?? evt.state,
          );
        } else {
          const body = await res.json().catch(() => ({}));
          if ("state" in evt) {
            console.log(`[gateway] -> ${evt.machineCode} state=${evt.state}`);
          } else {
            console.log(
              `[gateway] -> ${evt.machineCode} good+${evt.goodDelta} scrap+${evt.scrapDelta} ` +
                `(machineQty=${body.machineQty ?? "?"}${body.deduped ? ", deduped" : ""})`,
            );
          }
        }
        queue.shift();
        persistQueue();
      }
    } finally {
      flushing = false;
    }
  }

  // Batch accumulated production into one ingest event per machine per window.
  function drainWindow() {
    const now = Date.now();
    for (const { code, good, scrap } of agg.drain()) {
      const cfg = machines[code];
      if (!cfg) continue;
      enqueue({
        machineCode: code,
        token: cfg.token,
        eventId: windowEventId(code, now, windowMs),
        goodDelta: good,
        scrapDelta: scrap,
        producedAt: new Date(now).toISOString(),
      });
    }
    flush();
  }

  function handleCounter(code, cfg, data) {
    const prev = counters[code] ?? {};
    const good = computeDelta(prev.good, data.good, cfg.counterMax ?? null);
    const scrap = computeDelta(prev.scrap, data.scrap, cfg.counterMax ?? null);
    counters[code] = { good: data.good, scrap: data.scrap };
    persistCounters();
    if (good > 0 || scrap > 0) agg.add(code, good, scrap);
  }

  function forwardState(code, cfg, data) {
    if (!VALID_STATES.has(data.state)) {
      console.warn(`[gateway] bad state '${data.state}' for ${code}`);
      return;
    }
    enqueue({
      machineCode: code,
      token: cfg.token,
      state: data.state,
      at: data.ts ?? new Date().toISOString(),
    });
    flush();
  }

  const client = mqtt.connect(brokerUrl, { username, password });
  client.on("connect", () => {
    console.log(
      `[gateway] connected to broker ${brokerUrl}, forwarding to ${ingestUrl}`,
    );
    client.subscribe(["factory/+/pulse", "factory/+/counter", "factory/+/state"]);
  });

  client.on("message", (topic, payload) => {
    const [, code, kind] = topic.split("/");
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
    if (kind === "pulse") {
      agg.add(code, data.goodDelta ?? 0, data.scrapDelta ?? 0);
    } else if (kind === "counter") {
      handleCounter(code, cfg, data);
    } else if (kind === "state") {
      forwardState(code, cfg, data);
    }
  });

  const windowTimer = setInterval(drainWindow, windowMs);
  const retryTimer = setInterval(flush, 2000);
  return {
    client,
    stop: () => {
      clearInterval(windowTimer);
      clearInterval(retryTimer);
      client.end();
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startGateway();
}
