// One-process MQTT demo for the pitch: boots the MQTT broker + edge gateway
// (in-process) and spawns two machine simulators (cumulative counter + state,
// with MQTT last-will). Point it at the cloud with CLOUD_URL.
//
//   CLOUD_URL=https://portal-cliente-rosy.vercel.app npm run demo
import { spawn } from "node:child_process";
import "./broker.mjs";
import { startGateway } from "./gateway.mjs";

const BROKER_URL = process.env.BROKER_URL ?? "mqtt://localhost:1883";
const SIMS = [
  { code: "PRENSA-01", interval: 1200 },
  { code: "CNC-02", interval: 2000 },
];

const children = [];
setTimeout(() => {
  startGateway({ brokerUrl: BROKER_URL });
  for (const sim of SIMS) {
    console.log(`[demo] simulating ${sim.code} (counter+state)`);
    const c = spawn("node", ["simulator.mjs", sim.code, String(sim.interval)], {
      stdio: "inherit",
      env: { ...process.env, BROKER_URL },
    });
    children.push(c);
  }
}, 800);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const c of children) c.kill("SIGTERM");
    process.exit(0);
  });
}
