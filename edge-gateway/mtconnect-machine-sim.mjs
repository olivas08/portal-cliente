// Simulated machine-tool exposing an MTConnect Agent — the open standard for
// CNC / machine tools (HTTP + XML). A real agent answers /probe, /current and
// /sample; this sim serves a /current MTConnectStreams document with the data
// items a controller would publish:
//   PartCount name="good_parts"  (cumulative) — good parts
//   PartCount name="scrap_parts" (cumulative) — scrap parts
//   Execution                    — ACTIVE | READY | STOPPED
//   Availability                 — AVAILABLE | UNAVAILABLE
// The edge adapter (mtconnect-adapter.mjs) polls /current, parses the XML and
// republishes the values as the SAME MQTT messages the gateway understands.
import http from "node:http";
import { readFileSync } from "node:fs";

const CODE = process.argv[2] ?? process.env.MACHINE_CODE ?? "PRENSA-01";
const INTERVAL = Number(process.argv[3] ?? process.env.INTERVAL_MS ?? 1500);
const SCRAP_RATE = Number(process.env.SCRAP_RATE ?? 0.08);

const machines = JSON.parse(
  readFileSync(new URL("./machines.json", import.meta.url), "utf8"),
);
const cfg = machines[CODE] ?? {};
const mt = cfg.mtconnect ?? { agent: "http://127.0.0.1:5000" };
const MAX = cfg.counterMax ?? 4294967295;
const port = Number(new URL(mt.agent).port) || 5000;
const device = mt.device ?? CODE;

const instanceId = Math.floor(Date.now() / 1000);
let seq = 1;
let good = 0;
let scrap = 0;
let execution = "ACTIVE"; // ACTIVE | READY | STOPPED

const iso = () => new Date().toISOString();

function currentXml() {
  const ts = iso();
  const avail = "AVAILABLE";
  const last = seq;
  const di = (tag, name, sub, value) =>
    `        <${tag} dataItemId="${name}" name="${name}"` +
    (sub ? ` subType="${sub}"` : "") +
    ` timestamp="${ts}" sequence="${seq++}">${value}</${tag}>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<MTConnectStreams xmlns="urn:mtconnect.org:MTConnectStreams:2.0">
  <Header creationTime="${ts}" sender="OperonMTConnectSim" instanceId="${instanceId}" version="2.0.0" bufferSize="131072" firstSequence="1" lastSequence="${last}" nextSequence="${last + 1}"/>
  <Streams>
    <DeviceStream name="${device}" uuid="${device}">
      <ComponentStream component="Path" name="path" componentId="path1">
        <Events>
${di("PartCount", "good_parts", "GOOD", good)}
${di("PartCount", "scrap_parts", "BAD", scrap)}
${di("Execution", "execution", null, execution)}
${di("Availability", "availability", null, avail)}
        </Events>
      </ComponentStream>
    </DeviceStream>
  </Streams>
</MTConnectStreams>`;
}

const server = http.createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path.endsWith("/current") || path.endsWith("/sample")) {
    res.writeHead(200, { "content-type": "application/xml" });
    res.end(currentXml());
  } else if (path.endsWith("/probe") || path === "/") {
    res.writeHead(200, { "content-type": "application/xml" });
    res.end(
      `<?xml version="1.0" encoding="UTF-8"?>\n<MTConnectDevices xmlns="urn:mtconnect.org:MTConnectDevices:2.0"><Header creationTime="${iso()}" sender="OperonMTConnectSim" instanceId="${instanceId}" version="2.0.0"/><Devices><Device name="${device}" uuid="${device}"/></Devices></MTConnectDevices>`,
    );
  } else {
    res.writeHead(404).end();
  }
});

server.listen(port, () => {
  console.log(
    `[mtconnect-sim ${CODE}] MTConnect agent on ${mt.agent} ` +
      `(device ${device}, GET /current)`,
  );
});

// Produce parts while running (counters climb, wrapping like real hardware).
setInterval(() => {
  if (execution !== "ACTIVE") return;
  if (Math.random() < SCRAP_RATE) scrap = (scrap + 1) % (MAX + 1);
  else good = (good + 1) % (MAX + 1);
}, INTERVAL);

// Occasionally stop/resume (READY = idle, STOPPED = down downstream).
setInterval(() => {
  if (execution === "ACTIVE") {
    execution = Math.random() < 0.5 ? "READY" : "STOPPED";
  } else {
    execution = "ACTIVE";
  }
  console.log(`[mtconnect-sim ${CODE}] execution -> ${execution}`);
}, INTERVAL * 12);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
