// OPC-UA -> MQTT adapter. This is the REAL protocol adapter for CNC / modern
// controllers: it connects to a machine's OPC-UA server, reads the good/scrap/
// state nodes and republishes them as the SAME MQTT messages the gateway
// already understands. Swapping the simulator for a real controller is just a
// config change in machines.json (endpoint + node ids):
//
//   CNC(OPC-UA) -> [this adapter] -> MQTT -> [gateway] -> HTTPS -> cloud
import { readFileSync } from "node:fs";
import mqtt from "mqtt";
import {
  OPCUAClient,
  AttributeIds,
  SecurityPolicy,
  MessageSecurityMode,
} from "node-opcua";

const CODE = process.argv[2] ?? process.env.MACHINE_CODE ?? "CNC-02";
const POLL_MS = Number(process.argv[3] ?? process.env.POLL_MS ?? 1000);
const BROKER_URL = process.env.BROKER_URL ?? "mqtt://localhost:1883";

const machines = JSON.parse(
  readFileSync(new URL("./machines.json", import.meta.url), "utf8"),
);
const cfg = machines[CODE] ?? {};
const ua = cfg.opcua ?? {
  endpoint: "opc.tcp://127.0.0.1:4840",
  nodes: { good: "ns=1;s=Good", scrap: "ns=1;s=Scrap", state: "ns=1;s=State" },
};
const nodes = ua.nodes ?? {
  good: "ns=1;s=Good",
  scrap: "ns=1;s=Scrap",
  state: "ns=1;s=State",
};
const auth = cfg.mqtt ?? {};

const counterTopic = `factory/${CODE}/counter`;
const stateTopic = `factory/${CODE}/state`;
const VALID_STATES = new Set(["run", "idle", "down", "offline"]);

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

const client = OPCUAClient.create({
  applicationName: `OperonLink-${CODE}`,
  endpointMustExist: false,
  securityMode: MessageSecurityMode.None,
  securityPolicy: SecurityPolicy.None,
  connectionStrategy: { maxRetry: 3, initialDelay: 500, maxDelay: 2000 },
});

let session = null;
let lastState = null;

async function connectOpcua() {
  await client.connect(ua.endpoint);
  session = await client.createSession();
  console.log(`[adapter ${CODE}] OPC-UA ${ua.endpoint} connected`);
}

const toNum = (dv) => Number(dv?.value?.value ?? 0);

async function poll() {
  try {
    const [g, s, st] = await session.read([
      { nodeId: nodes.good, attributeId: AttributeIds.Value },
      { nodeId: nodes.scrap, attributeId: AttributeIds.Value },
      { nodeId: nodes.state, attributeId: AttributeIds.Value },
    ]);
    const good = toNum(g);
    const scrap = toNum(s);
    const ts = new Date().toISOString();
    mqc.publish(counterTopic, JSON.stringify({ good, scrap, ts }), { qos: 1 });

    const raw = String(st?.value?.value ?? "idle").toLowerCase();
    const state = VALID_STATES.has(raw) ? raw : "idle";
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

mqc.on("connect", async () => {
  console.log(`[adapter ${CODE}] MQTT connected, polling every ${POLL_MS}ms`);
  try {
    await connectOpcua();
  } catch (e) {
    console.error(`[adapter ${CODE}] OPC-UA connect failed:`, e.message);
    process.exit(1);
  }
  setInterval(poll, POLL_MS);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    mqc.publish(
      stateTopic,
      JSON.stringify({ state: "offline", ts: new Date().toISOString() }),
      { qos: 1, retain: true },
    );
    const done = () => mqc.end(true, () => process.exit(0));
    if (session) {
      session
        .close()
        .then(() => client.disconnect())
        .then(done)
        .catch(done);
    } else {
      done();
    }
  });
}
