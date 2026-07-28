// Machine simulator: pretends to be a press/CNC exposing a CUMULATIVE part
// counter plus a coarse machine state (run/idle/down) — exactly how a real PLC
// behaves. In production this file is replaced by a real adapter (Modbus TCP /
// OPC-UA / MTConnect / GPIO pulse counter) publishing the same messages.
//
// Publishes:
//   factory/<CODE>/counter {good, scrap, ts}   cumulative totals
//   factory/<CODE>/state   {state, ts}          run | idle | down
// Uses an MQTT Last-Will so the broker announces `offline` if this process dies.
import { readFileSync } from "node:fs";
import mqtt from "mqtt";

const CODE = process.argv[2] ?? process.env.MACHINE_CODE ?? "PRENSA-01";
const INTERVAL = Number(process.argv[3] ?? process.env.INTERVAL_MS ?? 1500);
const SCRAP_RATE = Number(process.env.SCRAP_RATE ?? 0.08);
const BROKER_URL = process.env.BROKER_URL ?? "mqtt://localhost:1883";

const machines = JSON.parse(
  readFileSync(new URL("./machines.json", import.meta.url), "utf8"),
);
const cfg = machines[CODE] ?? {};
const auth = cfg.mqtt ?? {};

const counterTopic = `factory/${CODE}/counter`;
const stateTopic = `factory/${CODE}/state`;

// Cumulative counters (only ever go up), like a real PLC register.
let good = 0;
let scrap = 0;
let state = "run";

const client = mqtt.connect(BROKER_URL, {
  username: auth.username,
  password: auth.password,
  will: {
    topic: stateTopic,
    payload: JSON.stringify({ state: "offline", ts: new Date().toISOString() }),
    qos: 1,
    retain: true,
  },
});

const pubState = (s) => {
  state = s;
  client.publish(
    stateTopic,
    JSON.stringify({ state: s, ts: new Date().toISOString() }),
    { qos: 1, retain: true },
  );
};

client.on("connect", () => {
  console.log(`[sim ${CODE}] connected; counter every ${INTERVAL}ms to ${counterTopic}`);
  pubState("run");

  // Produce parts while running.
  setInterval(() => {
    if (state !== "run") return;
    if (Math.random() < SCRAP_RATE) scrap += 1;
    else good += 1;
    client.publish(
      counterTopic,
      JSON.stringify({ good, scrap, ts: new Date().toISOString() }),
      { qos: 1 },
    );
  }, INTERVAL);

  // Occasionally stop the machine (idle/down) then resume — feeds OEE downtime.
  setInterval(() => {
    if (state === "run") {
      pubState(Math.random() < 0.5 ? "idle" : "down");
      console.log(`[sim ${CODE}] -> ${state} (paused)`);
    } else {
      pubState("run");
      console.log(`[sim ${CODE}] -> run (resumed)`);
    }
  }, INTERVAL * 12);
});

// Clean shutdown publishes offline explicitly.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    pubState("offline");
    client.end(true, () => process.exit(0));
  });
}
