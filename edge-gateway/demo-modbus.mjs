// Full INDUSTRIAL-path demo: MQTT broker + edge gateway (in-process) + two
// simulated PLCs speaking Modbus TCP, each fronted by a Modbus->MQTT adapter.
// Proves the real fieldbus path end-to-end with zero physical hardware:
//
//   PLC(Modbus TCP) -> adapter -> MQTT -> gateway -> HTTPS -> cloud
//
//   CLOUD_URL=https://portal-cliente-rosy.vercel.app npm run demo:modbus
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
    console.log(`[demo] PLC ${m.code} (Modbus TCP) + adapter`);
    run("modbus-machine-sim.mjs", [m.code, String(m.interval)]);
  }
  // Give the Modbus servers a moment to bind before adapters connect.
  setTimeout(() => {
    for (const m of MACHINES) run("modbus-adapter.mjs", [m.code, "1000"]);
  }, 1200);
}, 800);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const c of children) c.kill("SIGTERM");
    process.exit(0);
  });
}
