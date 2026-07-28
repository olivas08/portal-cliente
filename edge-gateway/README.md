# Operon Link (Edge Gateway)

Bridges factory machines to the Operon cloud so production counts (conformes
e sucata) come **directly from the machine** instead of being typed by the
operator — eliminating manual error and tampering.

```
[Máquina] --Modbus TCP / OPC-UA / MTConnect--> [Adapter] --MQTT--> [Edge Gateway] --HTTPS--> [Portal Cloud]
 PLC/CNC/sensor                                 factory/<CODE>/*     store-and-forward        /api/machine/ingest
```

The portal runs on serverless (Vercel), which cannot hold a permanent MQTT
connection. So **MQTT lives inside the factory** (machine → edge) and the edge
forwards to the cloud over **HTTPS** with a durable buffer.

## Components

| File | Role |
|------|------|
| `broker.mjs` | Local MQTT broker with **username/password auth** (credentials from `machines.json`). |
| `gateway.mjs` | Subscribes to `factory/+/{counter,state,pulse}`, turns **cumulative counters into deltas**, batches production per **time window**, forwards state changes, and delivers to the cloud with **store-and-forward** + idempotent `eventId`s. |
| `counter.mjs` | Pure helpers: cumulative→delta (handles reset/overflow), window aggregation. Unit-tested (`counter.test.mjs`). |
| `simulator.mjs` | Fake machine over MQTT: cumulative counter + state + last-will. |
| `modbus-machine-sim.mjs` | Fake **PLC speaking Modbus TCP** (holding registers: good/scrap/state). |
| `modbus-adapter.mjs` | **Real protocol adapter** — polls a PLC over Modbus TCP and republishes as MQTT. |
| `opcua-machine-sim.mjs` | Fake **CNC speaking OPC-UA** (server with Good/Scrap/State nodes). |
| `opcua-adapter.mjs` | **Real protocol adapter** — reads a controller over OPC-UA and republishes as MQTT. |
| `mtconnect-machine-sim.mjs` | Fake **machine tool with an MTConnect agent** (HTTP/XML: PartCount + Execution). |
| `mtconnect-adapter.mjs` | **Real protocol adapter** — polls an MTConnect agent's `/current` and republishes as MQTT. |
| `demo.mjs` | One-process MQTT demo (broker + gateway + 2 machines). |
| `demo-modbus.mjs` | One-process **full industrial demo** (broker + gateway + 2 PLCs + adapters). |
| `demo-opcua.mjs` | One-process **CNC demo** (broker + gateway + 2 OPC-UA controllers + adapters). |
| `demo-mtconnect.mjs` | One-process **machine-tool demo** (broker + gateway + 2 MTConnect agents + adapters). |
| `machines.json` | Per machine: cloud `token`, MQTT credentials, `counterMax`, Modbus / OPC-UA / MTConnect mapping. |

## Quick demo (for the pitch)

1. Register the machines in the portal (**Produção → Máquinas → Nova Máquina**),
   using codes/tokens that match `machines.json`. The seed already creates
   `PRENSA-01` and `CNC-02` with the demo tokens.
2. Start production on those stations from the terminal (a step must be
   *in progress* for counts to attach — otherwise they wait as *orphan* readings
   and bind automatically when the operator starts the step).
3. Run a demo, pointing at your portal:

   ```bash
   cd edge-gateway
   npm install
   # MQTT path (counter + state simulators):
   CLOUD_URL=https://portal-cliente-rosy.vercel.app npm run demo
   # …or the full industrial path (PLC over Modbus TCP -> adapter -> MQTT):
   CLOUD_URL=https://portal-cliente-rosy.vercel.app npm run demo:modbus
   # …or the CNC path (controller over OPC-UA -> adapter -> MQTT):
   CLOUD_URL=https://portal-cliente-rosy.vercel.app npm run demo:opcua
   # …or the machine-tool path (MTConnect agent -> adapter -> MQTT):
   CLOUD_URL=https://portal-cliente-rosy.vercel.app npm run demo:mtconnect
   ```

4. Watch **Produção → Máquinas** in the portal: the counts climb on their own,
   the machine **state** badge changes (run/idle/down), and the terminal marks
   the step as *verificado pela máquina*.

To prove the anti-tamper story: complete a machine-verified step in the terminal
and type a **different** quantity — the portal keeps the machine count and shows
the divergence in the *declarado vs. máquina* table.

To prove resilience: stop the portal (or disconnect), keep the demo running —
events buffer to `.buffer.jsonl`; restore connectivity and they drain.

## Running the pieces separately (closer to production)

MQTT machine:
```bash
npm run broker                        # terminal 1 — MQTT broker (auth)
CLOUD_URL=https://... npm run gateway  # terminal 2 — forwarder
npm run simulator PRENSA-01 1500      # terminal 3 — a machine
```

Modbus (industrial) machine:
```bash
npm run broker                        # terminal 1
CLOUD_URL=https://... npm run gateway  # terminal 2
npm run modbus-sim PRENSA-01 1500     # terminal 3 — a PLC (Modbus TCP server)
npm run modbus-adapter PRENSA-01 1000 # terminal 4 — Modbus->MQTT adapter
```

OPC-UA (CNC) machine:
```bash
npm run broker                        # terminal 1
CLOUD_URL=https://... npm run gateway  # terminal 2
npm run opcua-sim CNC-02 1500         # terminal 3 — a CNC (OPC-UA server)
npm run opcua-adapter CNC-02 1000     # terminal 4 — OPC-UA->MQTT adapter
```

MTConnect (machine tool) machine:
```bash
npm run broker                          # terminal 1
CLOUD_URL=https://... npm run gateway    # terminal 2
npm run mtconnect-sim PRENSA-01 1500    # terminal 3 — an MTConnect agent (HTTP)
npm run mtconnect-adapter PRENSA-01 1000 # terminal 4 — MTConnect->MQTT adapter
```

## Tests

```bash
npm test    # node --test — counter delta (reset/overflow) + window aggregation
```

## Going to real hardware

The Modbus, OPC-UA **and** MTConnect adapters are working templates. Choose the
path by machine type:

- **PLC-controlled (most industrial machines):** point `modbus-adapter.mjs` at the
  real PLC IP/port in `machines.json` and map the counter/state registers. Done.
- **CNC / modern controllers:** point `opcua-adapter.mjs` at the controller's
  OPC-UA endpoint in `machines.json` and map the Good/Scrap/State node ids.
  Real controllers add security (certificates + user auth) — set the matching
  `securityMode`/`securityPolicy` and credentials on the client. Done.
- **Dumb/old machines:** wire an inductive/photoelectric sensor to a Raspberry Pi
  **GPIO**, count pulses (one pulse = one part), publish `factory/<CODE>/counter`
  with the running total.
- **CNC / injection moulding protocols:** **MTConnect** (HTTP/XML — see
  `mtconnect-adapter.mjs`, a working template), Fanuc **FOCAS** or injection
  **Euromap 63/77**; write an adapter that publishes the same MQTT messages — the
  gateway and cloud stay unchanged.

Recommended hardware for the shop floor (dust/heat/24 V): an industrial gateway
such as **Revolution Pi**, Moxa or Advantech instead of a bare Raspberry Pi.

## Message contract (MQTT, inside the factory)

Cumulative counter (preferred — matches real PLC registers):
```
Topic: factory/<CODE>/counter
{ "good": 1234, "scrap": 56, "ts": "2026-07-28T10:00:00.000Z" }
```
The gateway diffs consecutive reads into deltas, coping with counter **reset**
(restart at 0) and **overflow** (`counterMax`, e.g. 65535 for a 16-bit register).

Machine state (feeds OEE availability):
```
Topic: factory/<CODE>/state   (retained)
{ "state": "run" | "idle" | "down" | "offline", "ts": "…" }
```
`offline` is published automatically via the MQTT **last-will** when a machine or
adapter disconnects.

Legacy per-part delta (still accepted):
```
Topic: factory/<CODE>/pulse
{ "eventId": "uuid", "goodDelta": 1, "scrapDelta": 0, "ts": "…" }
```

## Cloud endpoint: `POST /api/machine/ingest`

Production (one call per machine per window):
```json
{ "machineCode": "PRENSA-01", "token": "…", "eventId": "PRENSA-01-w…", "goodDelta": 4, "scrapDelta": 1, "producedAt": "…" }
```
State:
```json
{ "machineCode": "PRENSA-01", "token": "…", "state": "down", "at": "…" }
```

- Auth: per-machine `token` (bcrypt-hashed in the DB).
- Idempotent per `(machineCode, eventId)` — safe retries, no double counting.
- Production attaches to the *in-progress* step of the machine's workstation and
  marks it **machine-verified** (source of truth); pulses produced during setup
  bind to the step when it starts (**orphan reconciliation**).
- A `run` state (or any production) banks accumulated **downtime** onto the step
  when the machine resumes, feeding real OEE availability.
