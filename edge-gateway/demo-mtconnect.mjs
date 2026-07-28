// Full machine-tool demo: MQTT broker + edge gateway (in-process) + two
// simulated MTConnect agents (HTTP/XML), each fronted by an MTConnect->MQTT
// adapter. Proves the machine-tool standard path end-to-end, no hardware:
//
//   Machine tool(MTConnect) -> adapter -> MQTT -> gateway -> HTTPS -> cloud
//
//   CLOUD_URL=https://portal-cliente-rosy.vercel.app npm run demo:mtconnect
import { spawn } from "node:child_process";
import "./broker.mjs";
import { startGateway } from "./gateway.mjs";

const BROKER_URL = process.env.BROKER_URL ?? "mqtt://localhost:1883";
const MACHINES = [
  { code: "PRENSA-01", interval: 1200 },
  { code: "CNC-02", interval: 2000 },
];

const children = [];
const run = (file, args) => {
  const c = spawn("node", [file, ...args], {
    stdio: "inherit",
    env: { ...process.env, BROKER_URL },
  });
  children.push(c);
  return c;
};

setTimeout(() => {
  startGateway({ brokerUrl: BROKER_URL });
  for (const m of MACHINES) {
    console.log(`[demo] machine tool ${m.code} (MTConnect) + adapter`);
    run("mtconnect-machine-sim.mjs", [m.code, String(m.interval)]);
  }
  // Give the HTTP agents a moment to bind before the adapters poll.
  setTimeout(() => {
    for (const m of MACHINES) run("mtconnect-adapter.mjs", [m.code, "1000"]);
  }, 1200);
}, 800);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const c of children) c.kill("SIGTERM");
    process.exit(0);
  });
}
