// Local MQTT broker for the factory floor. Machines/sensors publish to
// `factory/<CODE>/pulse`. In production this runs on the edge gateway
// (Raspberry Pi / industrial gateway) inside the OT network.
import { createServer } from "node:net";
import Aedes from "aedes";

const PORT = Number(process.env.MQTT_PORT ?? 1883);

const aedes = new Aedes();
const server = createServer(aedes.handle);

aedes.on("client", (c) => console.log(`[broker] client connected: ${c.id}`));
aedes.on("clientDisconnect", (c) =>
  console.log(`[broker] client disconnected: ${c.id}`),
);
aedes.on("publish", (packet, client) => {
  if (client && packet.topic.startsWith("factory/")) {
    console.log(`[broker] ${packet.topic} <- ${packet.payload.toString()}`);
  }
});

server.listen(PORT, () => {
  console.log(`[broker] MQTT broker listening on :${PORT}`);
});

export { aedes, server };
