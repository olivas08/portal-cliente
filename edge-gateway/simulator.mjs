// Machine simulator: pretends to be a press/CNC emitting a "part done" pulse.
// In production this file is replaced by a real adapter that reads the machine:
//   - GPIO pulse counter (dumb machines: sensor on the ejector/cycle signal)
//   - Modbus TCP / OPC-UA register poll (PLC-controlled machines)
//   - MTConnect / Euromap 63/77 (CNC / injection moulding)
// ...and publishes the same `factory/<CODE>/pulse` MQTT message.
import { randomUUID } from "node:crypto";
import mqtt from "mqtt";

const CODE = process.argv[2] ?? process.env.MACHINE_CODE ?? "PRENSA-01";
const INTERVAL = Number(process.argv[3] ?? process.env.INTERVAL_MS ?? 2000);
const SCRAP_RATE = Number(process.env.SCRAP_RATE ?? 0.08);
const BROKER_URL = process.env.BROKER_URL ?? "mqtt://localhost:1883";

const client = mqtt.connect(BROKER_URL);
const topic = `factory/${CODE}/pulse`;

client.on("connect", () => {
  console.log(`[sim ${CODE}] publishing a part every ${INTERVAL}ms to ${topic}`);
  setInterval(() => {
    const scrap = Math.random() < SCRAP_RATE ? 1 : 0;
    const good = scrap ? 0 : 1;
    const msg = {
      eventId: randomUUID(),
      goodDelta: good,
      scrapDelta: scrap,
      ts: new Date().toISOString(),
    };
    client.publish(topic, JSON.stringify(msg), { qos: 1 });
  }, INTERVAL);
});
