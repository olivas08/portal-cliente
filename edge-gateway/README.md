# OIC Edge Gateway

Bridges factory machines to the OIC cloud portal so production counts (conformes
e sucata) come **directly from the machine** instead of being typed by the
operator — eliminating manual error and tampering.

```
[Máquina] --MQTT (rede da fábrica)--> [Edge Gateway] --HTTPS--> [Portal Cloud]
 sensor/PLC        factory/<CODE>/pulse   store-and-forward     /api/machine/ingest
```

The portal runs on serverless (Vercel), which cannot hold a permanent MQTT
connection. So **MQTT lives inside the factory** (machine → edge) and the edge
forwards to the cloud over **HTTPS** with a durable buffer.

## Components

| File | Role |
|------|------|
| `broker.mjs` | Local MQTT broker (runs on the edge, OT network). |
| `gateway.mjs` | Subscribes to `factory/+/pulse`, forwards to the cloud with **store-and-forward** (survives internet outages) and idempotent `eventId`s. |
| `simulator.mjs` | Fake machine emitting pulses — **replace with a real adapter** in production. |
| `demo.mjs` | One-process demo (broker + gateway + 2 machines) for the pitch. |
| `machines.json` | Maps `machineCode` → access `token` (must match the token set in the portal). |

## Quick demo (for the pitch)

1. Register the machines in the portal (**Produção → Máquinas → Nova Máquina**),
   using codes/tokens that match `machines.json`. The seed already creates
   `PRENSA-01` and `CNC-02` with the demo tokens.
2. Start production on those stations from the terminal (a step must be
   *in progress* for counts to attach).
3. Run the demo, pointing at your portal:

   ```bash
   cd edge-gateway
   npm install
   CLOUD_URL=https://portal-cliente-rosy.vercel.app npm run demo
   ```

4. Watch **Produção → Máquinas** in the portal: the counts climb on their own,
   machines show **Online**, and the terminal marks the step as
   *verificado pela máquina*.

To prove the anti-tamper story: complete a machine-verified step in the terminal
and type a **different** quantity — the portal keeps the machine count and shows
the divergence in the *declarado vs. máquina* table.

To prove resilience: stop the portal (or disconnect), keep the demo running —
pulses buffer to `.buffer.jsonl`; restore connectivity and they drain.

## Running the pieces separately (closer to production)

```bash
npm run broker                       # terminal 1 — MQTT broker
CLOUD_URL=https://... npm run gateway # terminal 2 — forwarder
npm run simulator PRENSA-01 1500     # terminal 3 — a machine
```

## Going to real hardware

Replace `simulator.mjs` with an adapter that publishes the same
`factory/<CODE>/pulse` message. Choose by machine type:

- **Dumb/old machines (most common):** wire an inductive/photoelectric sensor to
  a Raspberry Pi **GPIO** and count pulses (one pulse = one part). Reject-chute
  sensor for scrap. Message payload stays `{ goodDelta, scrapDelta, eventId, ts }`.
- **PLC-controlled:** poll a cycle-counter register via **Modbus TCP** or
  **OPC-UA** and publish the delta.
- **CNC / injection moulding:** use **MTConnect**, Fanuc **FOCAS**,
  **Euromap 63/77** or the machine's **OPC-UA** server.

Recommended hardware for the shop floor (dust/heat/24 V): an industrial gateway
such as **Revolution Pi**, Moxa or Advantech instead of a bare Raspberry Pi.

## Message contract

Topic: `factory/<machineCode>/pulse`

```json
{ "eventId": "uuid", "goodDelta": 1, "scrapDelta": 0, "ts": "2026-07-28T10:00:00.000Z" }
```

Cloud endpoint: `POST /api/machine/ingest`

```json
{ "machineCode": "PRENSA-01", "token": "…", "eventId": "uuid", "goodDelta": 1, "scrapDelta": 0, "producedAt": "…" }
```

- Auth: per-machine `token` (bcrypt-hashed in the DB).
- Idempotent per `(machineCode, eventId)` — safe retries, no double counting.
- The count attaches to the *in-progress* step of the machine's workstation and
  marks it **machine-verified** (source of truth).
