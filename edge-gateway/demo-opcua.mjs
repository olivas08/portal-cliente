// Full CNC-path demo: MQTT broker + edge gateway (in-process) + two simulated
// CNC controllers speaking OPC-UA, each fronted by an OPC-UA->MQTT adapter.
// Proves the modern-controller path end-to-end with zero physical hardware:
//
//   CNC(OPC-UA) -> adapter -> MQTT -> gateway -> HTTPS -> cloud
//
//   CLOUD_URL=https://portal-cliente-rosy.vercel.app npm run demo:opcua
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
    console.log(`[demo] CNC ${m.code} (OPC-UA) + adapter`);
    run("opcua-machine-sim.mjs", [m.code, String(m.interval)]);
  }
  // OPC-UA servers take longer to initialise than Modbus; give them a moment
  // to bind their endpoints before the adapters connect.
  setTimeout(() => {
    for (const m of MACHINES) run("opcua-adapter.mjs", [m.code, "1000"]);
  }, 3000);
}, 800);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const c of children) c.kill("SIGTERM");
    process.exit(0);
  });
}
