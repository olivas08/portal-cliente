// Simulated INDUSTRIAL machine speaking Modbus TCP — the most common fieldbus
// on factory PLCs. It exposes three 16-bit holding registers that a real PLC
// would expose:
//   reg 0: good parts   (cumulative, wraps at 65535)
//   reg 1: scrap parts  (cumulative, wraps at 65535)
//   reg 2: state        (0=down, 1=idle, 2=run)
// The edge adapter (modbus-adapter.mjs) polls these registers over TCP and
// republishes them as MQTT. No physical hardware required.
import { readFileSync } from "node:fs";
import Modbus from "modbus-serial";

const { ServerTCP } = Modbus;
const CODE = process.argv[2] ?? process.env.MACHINE_CODE ?? "PRENSA-01";
const INTERVAL = Number(process.argv[3] ?? process.env.INTERVAL_MS ?? 1500);
const SCRAP_RATE = Number(process.env.SCRAP_RATE ?? 0.08);
const MAX = 65535;

const machines = JSON.parse(
  readFileSync(new URL("./machines.json", import.meta.url), "utf8"),
);
const mb = machines[CODE]?.modbus ?? { host: "127.0.0.1", port: 5020, unitId: 1 };

const STATE = { down: 0, idle: 1, run: 2 };
let good = 0;
let scrap = 0;
let state = STATE.run;

const registers = () => [good, scrap, state];

const vector = {
  getHoldingRegister(addr, _unitID, cb) {
    cb(null, registers()[addr] ?? 0);
  },
  getInputRegister(addr, _unitID, cb) {
    cb(null, registers()[addr] ?? 0);
  },
};

const server = new ServerTCP(vector, {
  host: mb.host ?? "0.0.0.0",
  port: mb.port,
  unitID: mb.unitId ?? 1,
  debug: false,
});

server.on("socketError", (e) => console.error(`[modbus-sim ${CODE}]`, e.message));
server.on("serverError", (e) => console.error(`[modbus-sim ${CODE}]`, e.message));

console.log(`[modbus-sim ${CODE}] Modbus TCP on ${mb.host}:${mb.port} unit ${mb.unitId}`);

// Produce parts while running (registers count up, wrapping like real hardware).
setInterval(() => {
  if (state !== STATE.run) return;
  if (Math.random() < SCRAP_RATE) scrap = (scrap + 1) % (MAX + 1);
  else good = (good + 1) % (MAX + 1);
}, INTERVAL);

// Occasionally stop/resume the machine.
setInterval(() => {
  if (state === STATE.run) {
    state = Math.random() < 0.5 ? STATE.idle : STATE.down;
    console.log(`[modbus-sim ${CODE}] state -> ${state === STATE.idle ? "idle" : "down"}`);
  } else {
    state = STATE.run;
    console.log(`[modbus-sim ${CODE}] state -> run`);
  }
}, INTERVAL * 12);
