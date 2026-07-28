// One-process demo for the pitch: boots the MQTT broker, the edge gateway
// (MQTT -> HTTPS forwarder) and two simulated machines. Point it at the cloud
// with CLOUD_URL. In a real deployment these run as separate processes/services
// and the simulators are replaced by real machine adapters.
//
//   CLOUD_URL=https://portal-cliente-rosy.vercel.app npm run demo
import { randomUUID } from "node:crypto";
import mqtt from "mqtt";
import "./broker.mjs";
import { startGateway } from "./gateway.mjs";

const BROKER_URL = process.env.BROKER_URL ?? "mqtt://localhost:1883";

const SIMS = [
  { code: "PRENSA-01", interval: 1500, scrapRate: 0.08 },
  { code: "CNC-02", interval: 2500, scrapRate: 0.05 },
];

setTimeout(() => {
  startGateway({ brokerUrl: BROKER_URL });

  const pub = mqtt.connect(BROKER_URL);
  pub.on("connect", () => {
    for (const sim of SIMS) {
      console.log(`[demo] simulating ${sim.code} every ${sim.interval}ms`);
      setInterval(() => {
        const scrap = Math.random() < sim.scrapRate ? 1 : 0;
        pub.publish(
          `factory/${sim.code}/pulse`,
          JSON.stringify({
            eventId: randomUUID(),
            goodDelta: scrap ? 0 : 1,
            scrapDelta: scrap,
            ts: new Date().toISOString(),
          }),
          { qos: 1 },
        );
      }, sim.interval);
    }
  });
}, 800);
