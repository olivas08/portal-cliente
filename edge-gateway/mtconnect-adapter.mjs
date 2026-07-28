// MTConnect -> MQTT adapter. The REAL protocol adapter for machine tools using
// the MTConnect standard (HTTP + XML): it polls the agent's /current endpoint,
// parses the MTConnectStreams document and republishes good/scrap/state as the
// SAME MQTT messages the gateway already understands:
//
//   Machine tool(MTConnect agent) -> [this adapter] -> MQTT -> gateway -> cloud
//
// Data items are matched by their `name` attribute (configured in machines.json),
// which is how good vs scrap PartCounts are told apart.
import { readFileSync } from "node:fs";
import mqtt from "mqtt";
import { XMLParser } from "fast-xml-parser";

const CODE = process.argv[2] ?? process.env.MACHINE_CODE ?? "PRENSA-01";
const POLL_MS = Number(process.argv[3] ?? process.env.POLL_MS ?? 1000);
const BROKER_URL = process.env.BROKER_URL ?? "mqtt://localhost:1883";

const machines = JSON.parse(
  readFileSync(new URL("./machines.json", import.meta.url), "utf8"),
);
const cfg = machines[CODE] ?? {};
const mt = cfg.mtconnect ?? { agent: "http://127.0.0.1:5000" };
const items = mt.items ?? {
  good: "good_parts",
  scrap: "scrap_parts",
  execution: "execution",
  availability: "availability",
};
const auth = cfg.mqtt ?? {};
const currentUrl = mt.device
  ? `${mt.agent}/${mt.device}/current`
  : `${mt.agent}/current`;

const counterTopic = `factory/${CODE}/counter`;
const stateTopic = `factory/${CODE}/state`;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

// Walk the parsed MTConnect tree collecting every data item keyed by its
// `name` attribute -> text value. Robust to arbitrary nesting.
function collectByName(node, out) {
  if (Array.isArray(node)) {
    for (const n of node) collectByName(n, out);
    return out;
  }
  if (node && typeof node === "object") {
    const name = node["@_name"];
    if (name !== undefined && node["#text"] !== undefined) {
      out[name] = node["#text"];
    }
    for (const k of Object.keys(node)) {
      if (k.startsWith("@_") || k === "#text") continue;
      collectByName(node[k], out);
    }
  }
  return out;
}

function mapState(execution, availability) {
  if (String(availability).toUpperCase() === "UNAVAILABLE") return "offline";
  switch (String(execution).toUpperCase()) {
    case "ACTIVE":
      return "run";
    case "READY":
    case "ARMED":
      return "idle";
    case "STOPPED":
    case "INTERRUPTED":
    case "FEED_HOLD":
      return "down";
    default:
      return "idle";
  }
}

const mqc = mqtt.connect(BROKER_URL, {
  username: auth.username,
  password: auth.password,
  will: {
    topic: stateTopic,
    payload: JSON.stringify({ state: "offline", ts: new Date().toISOString() }),
    qos: 1,
    retain: true,
  },
});

let lastState = null;

async function poll() {
  try {
    const res = await fetch(currentUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const byName = collectByName(parser.parse(xml), {});

    const good = Number(byName[items.good] ?? 0);
    const scrap = Number(byName[items.scrap] ?? 0);
    const ts = new Date().toISOString();
    mqc.publish(counterTopic, JSON.stringify({ good, scrap, ts }), { qos: 1 });

    const state = mapState(byName[items.execution], byName[items.availability]);
    if (state !== lastState) {
      mqc.publish(stateTopic, JSON.stringify({ state, ts }), {
        qos: 1,
        retain: true,
      });
      lastState = state;
      console.log(`[adapter ${CODE}] state -> ${state}`);
    }
  } catch (e) {
    console.error(`[adapter ${CODE}] poll error:`, e.message);
  }
}

mqc.on("connect", () => {
  console.log(
    `[adapter ${CODE}] MQTT connected, polling ${currentUrl} every ${POLL_MS}ms`,
  );
  setInterval(poll, POLL_MS);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    mqc.publish(
      stateTopic,
      JSON.stringify({ state: "offline", ts: new Date().toISOString() }),
      { qos: 1, retain: true },
    );
    mqc.end(true, () => process.exit(0));
  });
}
