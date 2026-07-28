// Local MQTT broker for the factory floor. Machines/adapters publish to
// `factory/<CODE>/{counter,state,pulse}`. Runs on the edge gateway inside the
// OT network. Requires username/password auth so a rogue device on the plant
// network can't inject fake production.
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import Aedes from "aedes";

const PORT = Number(process.env.MQTT_PORT ?? 1883);
const machines = JSON.parse(
  readFileSync(new URL("./machines.json", import.meta.url), "utf8"),
);

// Accepted credentials: one per machine (from machines.json) + the gateway/
// adapter identity used to bridge to the cloud.
const creds = new Map();
creds.set(process.env.EDGE_USER ?? "edge", process.env.EDGE_PASS ?? "edge-secret");
for (const cfg of Object.values(machines)) {
  if (cfg.mqtt?.username) creds.set(cfg.mqtt.username, cfg.mqtt.password);
}

const aedes = new Aedes({
  authenticate(client, username, password, cb) {
    const expected = creds.get(username);
    const ok = expected != null && password?.toString() === expected;
    if (!ok) console.warn(`[broker] rejected auth for '${username}'`);
    cb(ok ? null : new Error("auth failed"), ok);
  },
});
const server = createServer(aedes.handle);

aedes.on("client", (c) => console.log(`[broker] connected: ${c.id}`));
aedes.on("clientDisconnect", (c) => console.log(`[broker] disconnected: ${c.id}`));
aedes.on("publish", (packet, client) => {
  if (client && packet.topic.startsWith("factory/")) {
    console.log(`[broker] ${packet.topic} <- ${packet.payload.toString()}`);
  }
});

server.listen(PORT, () => {
  console.log(`[broker] MQTT broker listening on :${PORT} (auth required)`);
});

export { aedes, server };
