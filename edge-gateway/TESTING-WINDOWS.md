# Testar localmente a integração com máquinas (Windows)

Guia passo-a-passo para testar, no teu portátil Windows, a recolha automática de
produção direto das máquinas (edge → cloud), incluindo estado da máquina,
downtime, reconciliação de órfãos e o caminho industrial completo em **Modbus TCP**
— tudo com **simuladores**, sem qualquer hardware físico.

> Tudo o que precisas: **Node.js 20+**, **Git** e o ficheiro **`.env`** do portal.
> Vais usar **2 a 3 janelas do PowerShell** ao mesmo tempo.

---

## 0. Pré-requisitos (uma só vez)

1. Instala o **Node.js 20 LTS ou superior** — https://nodejs.org (confirma com
   `node -v` no PowerShell).
2. Clona o repositório e instala as dependências:

   ```powershell
   git clone https://github.com/olivas08/portal-cliente.git
   cd portal-cliente
   npm install
   ```

3. Cria o ficheiro **`.env`** na raiz (copia de `.env.example` e preenche o
   `DATABASE_URL`/`DIRECT_URL` do Supabase e um `AUTH_SECRET`):

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   > O `DATABASE_URL` aponta para a **mesma** base de dados Supabase partilhada.
   > O seed **apaga e recria** os dados de demonstração — não uses uma BD com
   > dados reais.

4. Instala as dependências do edge gateway:

   ```powershell
   cd edge-gateway
   npm install
   cd ..
   ```

---

## 1. Preparar a base de dados (seed)

Cria os dados de demonstração, incluindo as 2 máquinas já registadas
(`PRENSA-01` e `CNC-02`) com os tokens que o edge usa:

```powershell
npm run db:seed
```

**Credenciais criadas pelo seed:**

| Perfil | Acesso |
|--------|--------|
| Admin | `admin@fabrica-demo.pt` / `admin2026` |
| Operador João Ferreira | PIN `1234` |
| Operador Miguel Costa | PIN `2345` |
| Operador Carla Sousa | PIN `3456` |

**Máquinas ↔ postos (importante para o teste):**

| Máquina | Posto (workstation) | Estado inicial |
|---------|--------------------|----------------|
| `PRENSA-01` | `CORTE` | idle |
| `CNC-02` | `CNC` | run |

---

## 2. Arrancar o portal

Na **janela 1** do PowerShell:

```powershell
npm run dev
```

Espera pela mensagem do Next.js e abre **http://localhost:3000**.

- Painel das máquinas (admin): **http://localhost:3000/admin/producao/maquinas**
  (login como admin). Atualiza sozinho a cada 5s.
- Terminal de chão-de-fábrica: **http://localhost:3000/producao/terminal?posto=CNC**

Deixa esta janela a correr.

---

## 3. Correr os simuladores das máquinas

Tens **quatro opções**. Começa pela A (mais simples); a B, C e D provam os
protocolos industriais reais (PLC, CNC-OPC-UA e máquinas-ferramenta MTConnect).

> ⚠️ **Sintaxe de variáveis de ambiente no PowerShell** é diferente do Linux/Mac.
> Usa `$env:NOME="valor";` **antes** do comando, na mesma linha.

### Opção A — Caminho MQTT (contador + estado)

Na **janela 2**:

```powershell
cd edge-gateway
$env:CLOUD_URL="http://localhost:3000"; npm run demo
```

Isto arranca, num só processo: o **broker MQTT** + o **edge gateway** + **2
máquinas simuladas** que emitem um contador cumulativo e mudam de estado
(run/idle/down).

### Opção B — Caminho industrial completo (Modbus TCP)

Prova o percurso real: **PLC (Modbus TCP) → adapter → MQTT → gateway → HTTPS → cloud**.

Na **janela 2**:

```powershell
cd edge-gateway
$env:CLOUD_URL="http://localhost:3000"; npm run demo:modbus
```

Arranca o broker + gateway + 2 **PLCs simulados em Modbus TCP**, cada um com o
seu **adapter** Modbus→MQTT.

### Opção C — Caminho CNC (OPC-UA)

Prova o percurso de uma CNC / controlador moderno:
**CNC (OPC-UA) → adapter → MQTT → gateway → HTTPS → cloud**.

Na **janela 2**:

```powershell
cd edge-gateway
$env:CLOUD_URL="http://localhost:3000"; npm run demo:opcua
```

Arranca o broker + gateway + 2 **CNC simuladas em OPC-UA** (servidor com nós
`Good`/`Scrap`/`State`), cada uma com o seu **adapter** OPC-UA→MQTT. O arranque
do servidor OPC-UA demora uns segundos a mais que o Modbus — é normal.

### Opção D — Caminho máquina-ferramenta (MTConnect)

Prova o percurso de uma máquina-ferramenta com agente MTConnect (HTTP/XML):
**Máquina (MTConnect) → adapter → MQTT → gateway → HTTPS → cloud**.

Na **janela 2**:

```powershell
cd edge-gateway
$env:CLOUD_URL="http://localhost:3000"; npm run demo:mtconnect
```

Arranca o broker + gateway + 2 **agentes MTConnect simulados** (servem
`/current` com `PartCount` + `Execution`), cada um com o seu **adapter**
MTConnect→MQTT.

Em qualquer das opções, vais ver no terminal linhas como:

```
[gateway] -> CNC-02 good+2 scrap+0 (machineQty=8)
[gateway] -> CNC-02 state=down
```

Para **parar**, carrega `Ctrl+C` na janela 2.

---

## 4. O que observar (checklist do que estás a testar)

Abre **/admin/producao/maquinas** e a coluna de contagens sobe sozinha. Confirma:

### ✅ Contagem automática (anti-fraude)
- `CNC-02` tem um passo **em curso** no seed, por isso as contagens da máquina
  ligam-se logo ao passo e o `machineQty` sobe no terminal.
- Abre **http://localhost:3000/producao/terminal?posto=CNC**, faz login com o
  PIN `2345` (Miguel) e vê o passo marcado como **verificado pela máquina** com a
  contagem a subir.

### ✅ Estado da máquina + downtime (OEE)
- No painel das máquinas, o **badge de estado** muda entre **A produzir**
  (a pulsar), **Parada** e **Inativa** à medida que o simulador alterna.
- Quando a máquina volta a **run**, o tempo que esteve parada é somado ao
  **downtime** do passo ativo (alimenta a disponibilidade do OEE).

### ✅ Reconciliação de órfãos (produção durante o setup)
- `PRENSA-01` (posto **CORTE**) **não** tem passo em curso no seed → as suas
  contagens ficam guardadas como **órfãs** (à espera).
- Abre **http://localhost:3000/producao/terminal?posto=CORTE**, login com PIN
  `1234` (João) e **inicia** um passo de corte. As leituras que a prensa produziu
  antes ligam-se automaticamente ao passo e entram na contagem.

### ✅ Divergência declarado vs. máquina
- No terminal, **conclui** um passo verificado pela máquina e escreve de
  propósito uma quantidade **diferente** da real.
- O portal **mantém a contagem da máquina** e mostra a diferença na tabela
  *declarado vs. máquina* em /admin/producao/maquinas.

### ✅ Resiliência (store-and-forward)
- Com o demo a correr, **para o portal** (Ctrl+C na janela 1). O gateway começa a
  **guardar** os eventos em `.buffer.jsonl`.
- Volta a arrancar o portal (`npm run dev`). Os eventos em buffer são **entregues**
  e as contagens acertam — nada se perde.

---

## 5. Correr os testes

**Testes do portal** (unitários — inclui estado, downtime e schemas das máquinas):

```powershell
npm test
```

**Testes do edge gateway** (delta de contador cumulativo, reset/overflow, janela):

```powershell
cd edge-gateway
npm test
cd ..
```

---

## 6. Correr as peças em separado (mais próximo de produção)

Se quiseres ver cada componente na sua janela (como numa fábrica real):

**Caminho MQTT** — 3 janelas:

```powershell
# janela A — broker MQTT
cd edge-gateway; npm run broker

# janela B — gateway (forwarder para a cloud)
cd edge-gateway; $env:CLOUD_URL="http://localhost:3000"; npm run gateway

# janela C — uma máquina
cd edge-gateway; npm run simulator PRENSA-01 1500
```

**Caminho Modbus** — 4 janelas:

```powershell
# janela A — broker
cd edge-gateway; npm run broker
# janela B — gateway
cd edge-gateway; $env:CLOUD_URL="http://localhost:3000"; npm run gateway
# janela C — PLC simulado (servidor Modbus TCP)
cd edge-gateway; npm run modbus-sim PRENSA-01 1500
# janela D — adapter Modbus -> MQTT
cd edge-gateway; npm run modbus-adapter PRENSA-01 1000
```

**Caminho OPC-UA (CNC)** — 4 janelas:

```powershell
# janela A — broker
cd edge-gateway; npm run broker
# janela B — gateway
cd edge-gateway; $env:CLOUD_URL="http://localhost:3000"; npm run gateway
# janela C — CNC simulada (servidor OPC-UA)
cd edge-gateway; npm run opcua-sim CNC-02 1500
# janela D — adapter OPC-UA -> MQTT
cd edge-gateway; npm run opcua-adapter CNC-02 1000
```

**Caminho MTConnect (máquina-ferramenta)** — 4 janelas:

```powershell
# janela A — broker
cd edge-gateway; npm run broker
# janela B — gateway
cd edge-gateway; $env:CLOUD_URL="http://localhost:3000"; npm run gateway
# janela C — agente MTConnect simulado (servidor HTTP)
cd edge-gateway; npm run mtconnect-sim PRENSA-01 1500
# janela D — adapter MTConnect -> MQTT
cd edge-gateway; npm run mtconnect-adapter PRENSA-01 1000
```

---

## 7. Testar o ingest diretamente (opcional, sem simuladores)

Podes simular uma máquina com um único `POST` (usa o token do seed). No
PowerShell usa `Invoke-RestMethod`:

Registar produção:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/machine/ingest -Method Post `
  -ContentType "application/json" `
  -Body '{"machineCode":"CNC-02","token":"cnc02-demo-token","eventId":"teste-1","goodDelta":5,"scrapDelta":1}'
```

Mudar o estado da máquina (ex.: avaria e retoma → gera downtime):

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/machine/ingest -Method Post `
  -ContentType "application/json" `
  -Body '{"machineCode":"CNC-02","token":"cnc02-demo-token","state":"down"}'

Invoke-RestMethod -Uri http://localhost:3000/api/machine/ingest -Method Post `
  -ContentType "application/json" `
  -Body '{"machineCode":"CNC-02","token":"cnc02-demo-token","state":"run"}'
```

Repetir o mesmo `eventId` **não** duplica a contagem (idempotência).

---

## 8. Testar contra o ambiente publicado (Vercel)

Também podes apontar os simuladores ao portal já publicado, em vez do local —
basta mudar o `CLOUD_URL`:

```powershell
cd edge-gateway
$env:CLOUD_URL="https://portal-cliente-rosy.vercel.app"; npm run demo:modbus
```

> Nesse caso, faz o seed contra a mesma BD (`npm run db:seed`) para garantir que
> as máquinas e tokens existem, e observa em
> https://portal-cliente-rosy.vercel.app/admin/producao/maquinas

---

## Resolução de problemas

| Sintoma | Causa provável / solução |
|---------|--------------------------|
| `[gateway] cloud unreachable` | O portal não está a correr ou o `CLOUD_URL` está errado. Confirma a janela 1 e o `$env:CLOUD_URL`. |
| Contagens não sobem no painel | A máquina não tem passo **em curso** no posto → é o caso da `PRENSA-01` (órfãos). Inicia um passo no terminal (passo 4, órfãos). |
| `rejected auth` no broker | Credenciais MQTT do simulador não batem certo com `machines.json`. Não alteres os `mqtt.username/password`. |
| `EADDRINUSE :1883` | Já tens um broker a correr noutra janela. Fecha-o antes de correr o `demo`. |
| Porta 3000 ocupada | Fecha o `npm run dev` anterior (ou usa `npx kill-port 3000`). |
| Tokens inválidos | Corre `npm run db:seed` outra vez — recria as máquinas com os tokens do edge. |

---

## Onde ficam os ficheiros temporários

O gateway cria (e o `.gitignore` ignora):

- `edge-gateway/.buffer.jsonl` — eventos por entregar (store-and-forward).
- `edge-gateway/.counters.json` — último valor dos contadores cumulativos.

Podes apagá-los à vontade para começar do zero.
