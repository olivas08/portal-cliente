// Simulated CNC machine speaking OPC-UA — the most common protocol on modern
// CNC / machining centres (and the backbone of Industry 4.0). It runs a real
// OPC-UA server exposing three variables a real controller would publish:
//   Good  (UInt32, cumulative) — good parts counter
//   Scrap (UInt32, cumulative) — scrap parts counter
//   State (String)             — "run" | "idle" | "down"
// The edge adapter (opcua-adapter.mjs) connects as an OPC-UA client, reads
// these nodes and republishes them as the SAME MQTT messages the gateway
// already understands. No physical hardware required.
import { readFileSync } from "node:fs";
import {
  OPCUAServer,
  Variant,
  DataType,
  SecurityPolicy,
  MessageSecurityMode,
} from "node-opcua";

const CODE = process.argv[2] ?? process.env.MACHINE_CODE ?? "CNC-02";
const INTERVAL = Number(process.argv[3] ?? process.env.INTERVAL_MS ?? 1500);
const SCRAP_RATE = Number(process.env.SCRAP_RATE ?? 0.08);

const machines = JSON.parse(
  readFileSync(new URL("./machines.json", import.meta.url), "utf8"),
);
const cfg = machines[CODE] ?? {};
const ua = cfg.opcua ?? { endpoint: "opc.tcp://127.0.0.1:4840" };
const MAX = cfg.counterMax ?? 4294967295; // 32-bit counter

// Derive the TCP port from the configured endpoint (opc.tcp://host:port/path).
const port = Number(new URL(ua.endpoint.replace("opc.tcp://", "http://")).port) || 4840;

let good = 0;
let scrap = 0;
let state = "run";

const server = new OPCUAServer({
  port,
  resourcePath: "", // endpoint = opc.tcp://host:port
  buildInfo: { productName: `OperonCNCSim-${CODE}`, manufacturerName: "Operon" },
  // Demo only: no security. Real controllers use certificates + user auth.
  securityPolicies: [SecurityPolicy.None],
  securityModes: [MessageSecurityMode.None],
  allowAnonymous: true,
});

async function main() {
  await server.initialize();

  const addressSpace = server.engine.addressSpace;
  const namespace = addressSpace.getOwnNamespace(); // ns=1

  const device = namespace.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: `CNC_${CODE}`,
  });

  namespace.addVariable({
    componentOf: device,
    nodeId: "s=Good",
    browseName: "Good",
    dataType: "UInt32",
    value: {
      get: () => new Variant({ dataType: DataType.UInt32, value: good }),
    },
  });
  namespace.addVariable({
    componentOf: device,
    nodeId: "s=Scrap",
    browseName: "Scrap",
    dataType: "UInt32",
    value: {
      get: () => new Variant({ dataType: DataType.UInt32, value: scrap }),
    },
  });
  namespace.addVariable({
    componentOf: device,
    nodeId: "s=State",
    browseName: "State",
    dataType: "String",
    value: {
      get: () => new Variant({ dataType: DataType.String, value: state }),
    },
  });

  await server.start();
  console.log(
    `[opcua-sim ${CODE}] OPC-UA server on ${server.getEndpointUrl()} ` +
      `(nodes ns=1;s=Good, s=Scrap, s=State)`,
  );

  // Produce parts while running (counters climb, wrapping like real hardware).
  setInterval(() => {
    if (state !== "run") return;
    if (Math.random() < SCRAP_RATE) scrap = (scrap + 1) % (MAX + 1);
    else good = (good + 1) % (MAX + 1);
  }, INTERVAL);

  // Occasionally stop/resume the machine (feeds OEE availability downstream).
  setInterval(() => {
    if (state === "run") {
      state = Math.random() < 0.5 ? "idle" : "down";
    } else {
      state = "run";
    }
    console.log(`[opcua-sim ${CODE}] state -> ${state}`);
  }, INTERVAL * 12);
}

main().catch((e) => {
  console.error(`[opcua-sim ${CODE}] fatal:`, e.message);
  process.exit(1);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    server.shutdown(() => process.exit(0));
  });
}
