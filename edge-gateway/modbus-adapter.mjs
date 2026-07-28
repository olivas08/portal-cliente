// Modbus TCP -> MQTT adapter. This is the REAL protocol adapter: it polls a
// machine's PLC over Modbus TCP and republishes the values as the same MQTT
// messages the gateway already understands. Swapping the MQTT simulator for
// this proves the full industrial path with zero code changes downstream:
//
//   PLC(Modbus TCP) -> [this adapter] -> MQTT -> [gateway] -> HTTPS -> cloud
import { readFileSync } from "node:fs";
import mqtt from "mqtt";
import Modbus from "modbus-serial";

const CODE = process.argv[2] ?? process.env.MACHINE_CODE ?? "PRENSA-01";
const POLL_MS = Number(process.argv[3] ?? process.env.POLL_MS ?? 1000);
const BROKER_URL = process.env.BROKER_URL ?? "mqtt://localhost:1883";

const machines = JSON.parse(
  readFileSync(new URL("./machines.json", import.meta.url), "utf8"),
);
const cfg = machines[CODE] ?? {};
const mb = cfg.modbus ?? { host: "127.0.0.1", port: 5020, unitId: 1 };
const auth = cfg.mqtt ?? {};
const STATE_NAMES = { 0: "down", 1: "idle", 2: "run" };

const counterTopic = `factory/${CODE}/counter`;
const stateTopic = `factory/${CODE}/state`;

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

const modbus = new Modbus();
let lastState = null;

async function connectModbus() {
  await modbus.connectTCP(mb.host, { port: mb.port });
  modbus.setID(mb.unitId ?? 1);
  console.log(`[adapter ${CODE}] Modbus TCP ${mb.host}:${mb.port} connected`);
}

async function poll() {
  try {
    const { data } = await modbus.readHoldingRegisters(0, 3);
    const [good, scrap, stateCode] = data;
    const ts = new Date().toISOString();
    mqc.publish(counterTopic, JSON.stringify({ good, scrap, ts }), { qos: 1 });
    const state = STATE_NAMES[stateCode] ?? "idle";
    if (state !== lastState) {
      mqc.publish(stateTopic, JSON.stringify({ state, ts }), { qos: 1, retain: true });
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
    await connectModbus();
  } catch (e) {
    console.error(`[adapter ${CODE}] Modbus connect failed:`, e.message);
    process.exit(1);
  }
  setInterval(poll, POLL_MS);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    mqc.publish(stateTopic, JSON.stringify({ state: "offline", ts: new Date().toISOString() }), { qos: 1, retain: true });
    mqc.end(true, () => process.exit(0));
  });
}
