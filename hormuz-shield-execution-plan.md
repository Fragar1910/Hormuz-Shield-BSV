# HormuzShield Oil — Plan de ejecución

## Sprint operativo: 1 abril → 17 abril 2026

---

## FASE 0: Pre-hackathon (1–5 abril) — ANTES DE QUE EMPIECE

### Día 1–2 (1–2 abril) — Registro + setup del entorno

**CRÍTICO: El registro cierra el 3 de abril.**

```
x Registrarte en https://hackathon.bsvb.tech/register
x Unirte al Discord de BSV: https://discord.com/invite/bsv
x Registrarte en aisstream.io → obtener API key (gratis)
x Descargar BSV Desktop Wallet: https://desktop.bsvb.tech
□ Comprar ~$50 en BSV (para fees + funding de agents)
```

**Setup del entorno de desarrollo:**

```bash
# 1. Crear directorio del proyecto
mkdir hormuz-shield && cd hormuz-shield
git init

# 2. Inicializar monorepo
npm init -y
# Configurar workspaces en package.json

# 3. Instalar BSV stack
npm install @bsv/sdk @bsv/wallet-toolbox

# 4. Instalar BSV MCP para Claude Code
npx @bsv/bsv-claude-agents

# 5. Clonar repos BSV para referencia local
mkdir bsv-repos && cd bsv-repos
git clone https://github.com/bsv-blockchain/ts-sdk.git
git clone https://github.com/bitcoin-sv/wallet-toolbox.git // no funciona
git clone https://github.com/bsv-blockchain/simple.git
git clone https://github.com/bsv-blockchain/message-box-client.git
git clone https://github.com/bitcoin-sv/payment-express-middleware.git
cd ..

# 6. Configurar @bsv/mcp en Claude Code
# En .claude/mcp.json:
{
  "mcpServers": {
    "@bsv/mcp": {
      "command": "npx",
      "args": ["-y", "@bsv/mcp"],
      "env": { "BSV_REPOS_DIR": "./bsv-repos" }
    }
  }
}

# 7. Verificar que Claude Code tiene acceso al MCP
# Preguntar: "Find where Wallet is defined in the ts-sdk"
```

### Día 3 (3 abril) — Aprendizaje BSV acelerado

**Objetivo: entender el modelo UTXO + wallets + pagos P2P en BSV**

```
□ Leer: https://docs.bsvblockchain.org/guides/sdks/ts/getting_started_node_cjs
□ Crear un script básico que:
  - Cree 2 wallets (testnet)
  - Envíe 100 satoshis de wallet A a wallet B
  - Verifique el balance
□ Leer BRC-100 (wallet standard): pedir a Claude Code "Explain BRC-100"
□ Leer sobre MessageBox P2P: revisar el repo message-box-client
□ Leer sobre payment-express-middleware: entender el flow 402
```

**Script de prueba mínimo (con Claude Code):**

```
Prompt para Claude Code:
"Using @bsv/sdk and @bsv/wallet-toolbox, create a minimal 
TypeScript script that:
1. Creates two testnet wallets with SQLite storage
2. Funds wallet A from a testnet faucet
3. Sends 100 satoshis from wallet A to wallet B
4. Prints both balances
5. Records an OP_RETURN message 'HORMUZ_TEST' on-chain"
```

### Día 4 (4 abril) — Prueba AIS + MessageBox

```
□ Probar conexión WebSocket a aisstream.io con API key
□ Filtrar por BoundingBox del Estrecho de Hormuz:
  - SW: [56.0, 25.5]  NE: [57.5, 27.0]
□ Verificar que llegan PositionReport de petroleros reales
□ Probar MessageBox: enviar mensaje entre 2 wallets
□ Probar PeerPayClient: pago P2P entre 2 wallets
```

**BoundingBoxes para las zonas de riesgo:**

```typescript
const HORMUZ_ZONES = {
  STRAIT_CORE: [[56.0, 25.5], [57.5, 27.0]],      // Estrecho propio
  PERSIAN_GULF: [[49.0, 24.0], [56.0, 30.5]],      // Golfo Pérsico
  GULF_OF_OMAN: [[57.0, 22.5], [62.0, 26.5]],      // Golfo de Omán
  BAB_EL_MANDEB: [[42.5, 12.0], [44.5, 13.5]],     // Bab el-Mandeb
  GULF_OF_ADEN: [[43.0, 11.0], [51.0, 15.0]],      // Golfo de Adén
};
```

### Día 5 (5 abril) — Arquitectura final + SDD specs

```
□ Escribir interfaces TypeScript definitivas (types.ts)
□ Escribir tests skeleton para cada agente
□ Definir la estructura de carpetas final del monorepo
□ Preparar .env.example con todas las variables
□ Crear README.md base del proyecto
□ Preparar scripts de deployment (Docker o PM2)
□ Asegurar que BSV Desktop Wallet tiene fondos en mainnet
```

---

## FASE 1: Foundation (6–8 abril) — Los 3 primeros días del hackathon

### Día 6 (lunes 6 abril) — Skeleton + wallets + primer tx on-chain

**META: Al final del día, 4 wallets creadas y al menos 1 tx real en mainnet BSV.**

```
Mañana (4h):
□ Inicializar monorepo completo con workspaces
□ packages/shared: tipos, interfaces, config, risk zones
□ Crear wallet de cada agente (mainnet):
  - risk-oracle wallet
  - insurer-pool wallet
  - shipowner wallet
  - claims-verifier wallet
□ Fund cada wallet desde BSV Desktop Wallet (~$10 cada una)
□ Verificar: cada wallet puede enviar/recibir sats

Tarde (4h):
□ Primer OP_RETURN on-chain: {type: "HORMUZ_GENESIS", timestamp}
□ Script run-all-agents.ts que arranca los 4 procesos
□ Logging centralizado (todos los agentes escriben a stdout)
□ Commit + push
```

**Prompt clave para Claude Code:**

```
"Create the shared package with all TypeScript interfaces for
HormuzShield. Include: RiskScore, MicroPolicy, IncidentSignal,
VesselPosition, RiskZone. Then create wallet initialization 
for 4 agents using @bsv/wallet-toolbox with SQLite storage 
on mainnet. Each agent should have its own root key from env."
```

### Día 7 (martes 7 abril) — Risk Oracle funcional

**META: El Risk Oracle ingiere AIS real y genera risk scores.**

```
Mañana (4h):
□ ais-client.ts: WebSocket a aisstream.io
  - BoundingBox: Hormuz + Persian Gulf + Gulf of Oman
  - Parsear PositionReport → VesselPosition
  - Buffer en memoria de últimas 1000 posiciones
□ risk-engine.ts: calcular RiskScore por vessel
  - Point-in-polygon para detectar zona activa
  - Factores: zona base + velocidad + rumbo + hora

Tarde (4h):
□ payment-server.ts: Express + payment middleware
  - GET /risk-score/:mmsi → 1 sat → devuelve RiskScore
  - GET /zone-status/:zone_id → 1 sat → devuelve ZoneStatus
□ Cada risk score calculado → tx OP_RETURN on-chain
□ Test: curl al endpoint, verificar que cobra 1 sat
□ Commit + push
```

### Día 8 (miércoles 8 abril) — MessageBox P2P entre agentes

**META: Los agentes se descubren y comunican vía MessageBox.**

```
Mañana (4h):
□ Configurar MessageBoxClient en cada agente
□ Risk Oracle publica identity key
□ Insurer Pool descubre Risk Oracle vía identity
□ Primer pago P2P: Insurer paga Oracle por risk data
□ Verificar: tx aparece en blockchain

Tarde (4h):
□ Shipowner descubre Insurer Pool
□ Flujo básico: Shipowner pide quote → Insurer responde
□ PeerPayClient: Shipowner paga premium al Insurer
□ Logging de todos los mensajes MessageBox
□ Commit + push

CHECKPOINT FASE 1:
✓ 4 agentes con wallets activas en mainnet
✓ Risk Oracle ingiere AIS real y calcula risk scores
✓ Agentes se descubren vía MessageBox (BRC-100)
✓ Al menos un flujo de pago funciona end-to-end
✓ Transacciones reales en BSV blockchain
```

---

## FASE 2: Core agents (9–12 abril)

### Día 9 (jueves 9 abril) — Insurer Pool completo

```
Mañana (4h):
□ pricing-engine.ts: cálculo dinámico de primas
  - Input: risk score del oracle + hull value + duración
  - Output: premium en satoshis
  - Factor pool utilization (exposure/capacity)
□ policy-manager.ts: emisión de micro-pólizas
  - Cada póliza = 1 minuto de cobertura
  - Registrar póliza on-chain vía OP_RETURN

Tarde (4h):
□ pool-treasury.ts: gestión del pool
  - Balance tracking
  - Exposure limits (no más del 30% del pool en un vessel)
□ claims-handler.ts: evaluación básica de claims
  - Recibe claim → verifica póliza activa → aprueba/rechaza
□ Tests unitarios del pricing engine
□ Commit + push
```

### Día 10 (viernes 10 abril) — Shipowner fleet simulation

```
Mañana (4h):
□ fleet-simulator.ts: 50 vessels con rutas realistas
  - 20 VLCCs (oil tankers, $100M hull value)
  - 15 Suezmaxes ($80M hull value)
  - 10 Aframaxes ($60M hull value)
  - 5 LNG carriers ($200M hull value)
  - Rutas: Ras Tanura→Hormuz→Fujairah, Kuwait→Hormuz→Mumbai, etc.
□ Cada vessel: posición se actualiza cada 10 segundos
  - Velocidad realista: 12-15 nudos
  - Desvíos aleatorios de ruta (simula condiciones)

Tarde (4h):
□ coverage-manager.ts: lógica de compra automática
  - Si vessel en zona de riesgo → comprar póliza
  - Si ya tiene póliza activa → renovar al expirar
  - Si sale de zona → dejar expirar
□ Cada compra de risk data al oracle → micropago
□ Cada compra de póliza al insurer → micropago
□ Commit + push
```

### Día 11 (sábado 11 abril) — Claims Verifier + incidents

```
Mañana (4h):
□ verification-engine.ts: verificación de claims
  - Cross-reference AIS data en el momento del incidente
  - Verificar: ¿vessel estaba en zona reportada?
  - Verificar: ¿había anomalía de velocidad/rumbo?
  - Score de confianza: 0.0–1.0
□ Cobro de fee por cada verificación

Tarde (4h):
□ incident-simulator.ts: generar incidentes aleatorios
  - Cada ~10 minutos, un vessel sufre un "incidente"
  - Tipos: AIS gap, speed anomaly, proximity alert
  - Shipowner detecta → file claim → Verifier valida
  - Insurer paga si claim aprobado
□ Flujo completo end-to-end con claim settlement
□ Commit + push
```

### Día 12 (domingo 12 abril) — Primer burn test 24h

```
TODO EL DÍA:
□ Arrancar los 4 agentes simultáneamente
□ Dejar corriendo 4-6 horas mínimo
□ Monitorizar:
  - ¿Cuántas txs/hora se generan?
  - ¿Se fragmentan los UTXOs? → implementar consolidación
  - ¿Los wallets se quedan sin fondos? → refundir
  - ¿El MessageBox aguanta el volumen?
  - ¿Hay memory leaks en los procesos?
□ Calcular: a este ritmo, ¿llegaremos a 1.5M en 24h?
□ Si < 1.5M projected: ajustar intervalos de polling
□ Fix bugs críticos encontrados
□ Commit + push

CHECKPOINT FASE 2:
✓ 4 agentes funcionando autónomamente
✓ Risk Oracle: AIS real → risk scores → venta por micropago
✓ Insurer: pricing dinámico → pólizas/minuto → claims
✓ Shipowner: 50 vessels → compra cobertura automática
✓ Verifier: valida claims → cobra fees
✓ Flujo de incidents + claims funcional
✓ Primer test de volumen con métricas reales
```

---

## FASE 3: Volume + optimization (13–14 abril)

### Día 13 (lunes 13 abril) — Optimización de volumen

```
Mañana (4h):
□ Analizar resultados del burn test
□ Si txs < target: añadir más fuentes de transacciones
  - Position attestations: cada vessel registra posición on-chain
  - Risk score broadcasts: oracle publica updates para todos
  - Pool rebalancing: insurer rebalancea cada 5 minutos
  - Reputation updates: verifier actualiza reputación on-chain
□ UTXO consolidation script: cada 30 min, consolidar UTXOs

Tarde (4h):
□ Ajustar intervalos finales para alcanzar ~2.5M/24h
□ Fondear wallets para 24h+ de operación continua
  - Calcular: (txs/24h × fee/tx) + margin
  - Cargar desde BSV Desktop Wallet
□ Preparar VPS para el burn de 24h oficial
  - DigitalOcean droplet: 4 vCPU, 8GB RAM, SSD
  - Node.js 20+, PM2 para process management
□ Deploy all agents al VPS
□ Test run 2h en VPS
```

### Día 14 (martes 14 abril) — 24h official burn window

```
⚠️  ESTE ES EL DÍA CRÍTICO

00:00 UTC (o cuando decidas):
□ Arrancar los 4 agentes en VPS con PM2
□ Verificar que todos los procesos están up
□ Verificar primer batch de txs on-chain

Cada 2 horas:
□ Check dashboard de métricas
□ Verificar tx count acumulado
□ Verificar wallet balances
□ Verificar que no hay procesos caídos
□ Screenshot para el demo video

Al final del día:
□ VERIFICAR: ≥ 1.5M transacciones en 24h
□ Exportar métricas finales
□ Guardar txids representativos como evidencia
□ Continuar running para acumular más txs
```

---

## FASE 4: UI + submission (15–17 abril)

### Día 15 (miércoles 15 abril) — Web dashboard

```
Mañana (4h):
□ React app con Vite + TypeScript
□ MapView.tsx: Leaflet con zona del Golfo Pérsico
  - Vessel markers con color por risk level
  - Risk zone polygons semitransparentes
  - Popups con info del vessel + póliza activa
□ WebSocket connection al backend para datos real-time

Tarde (4h):
□ AgentPanel.tsx: 4 cards de status de agentes
  - Wallet balance (live)
  - Txs sent/received (counter)
  - Active policies / pending claims
□ TxFeed.tsx: feed scrollable de transacciones recientes
□ MetricsBar.tsx: counters en la parte superior
  - Total transactions (live counter grande)
  - Total BSV volume
  - Active policies
  - Average risk score
□ Deploy UI al VPS (servida por Express)
□ Commit + push
```

### Día 16 (jueves 16 abril) — Demo video + polish

```
Mañana (4h):
□ Grabar demo video (3-5 minutos):
  - Intro: "While we're here, tankers are stranded..."
  - Show: mapa con vessels moviéndose en tiempo real
  - Explain: flujo de micropagos entre agentes
  - Show: transaction counter subiendo
  - Show: incident → claim → settlement automático
  - Close: "This is what autonomous insurance looks like"
□ Editar video (cortar, añadir overlays si necesario)

Tarde (4h):
□ Escribir README.md completo:
  - Problem statement (con datos reales de Hormuz)
  - Solution overview
  - Architecture diagram
  - How to run
  - Transaction volume evidence
  - Tech stack
  - Team
□ Limpiar código, quitar console.logs innecesarios
□ Verificar que el repo es presentable
□ Commit final
```

### Día 17 (viernes 17 abril) — Submission

```
⚠️  DEADLINE: 23:59 UTC

Mañana:
□ Verificar que todos los agentes siguen corriendo
□ Último screenshot de métricas (tx count final)
□ Verificar que la UI funciona y es accesible
□ Subir video a YouTube (unlisted)

Mediodía:
□ SUBMIT en https://hackathon.bsvb.tech/
  - Link al repo GitHub
  - Link al demo video
  - Link a la UI live (si el VPS sigue up)
  - Description del proyecto
  - Evidence de transaction volume

Tarde:
□ Post en Discord de BSV con summary del proyecto
□ Celebrar (o dormir) 🍺
```

---

## Checklist de herramientas necesarias

### Cuentas (crear ANTES del 6 abril)

| Servicio | URL | Coste | Propósito |
|----------|-----|-------|-----------|
| Hackathon | hackathon.bsvb.tech/register | Gratis | Registro |
| BSV Discord | discord.com/invite/bsv | Gratis | Soporte |
| aisstream.io | aisstream.io | Gratis | AIS API key |
| BSV Desktop Wallet | desktop.bsvb.tech | Gratis | Fundir agents |
| DigitalOcean | digitalocean.com | ~$20 | VPS para burn |
| GitHub | github.com | Gratis | Repo |

### Compras

| Item | Coste estimado |
|------|---------------|
| BSV para fees (~2.5M txs) | ~$25 |
| BSV buffer para fondear wallets | ~$25 |
| VPS DigitalOcean (4 días) | ~$5 |
| **TOTAL** | **~$55** |

### Stack técnico

```
Runtime:        Node.js 20+ / TypeScript 5.x
BSV:            @bsv/sdk, @bsv/wallet-toolbox
P2P:            @bsv/message-box-client (MessageBox + PeerPay)
Payments:       payment-express-middleware
AIS:            aisstream.io WebSocket (ws package)
Server:         Express.js
UI:             React 18 + Vite + Leaflet.js + Recharts
Process mgmt:   PM2
Dev assist:      Claude Code + @bsv/mcp + @bsv/bsv-claude-agents
```

---

## Cómo usar Claude Code cada día

### Patrón de trabajo diario

```
1. Abrir Claude Code en el directorio del proyecto
2. Verificar que @bsv/mcp está cargado ("list BSV resources")
3. Describir el módulo a construir con spec precisa
4. Claude Code genera el código
5. Revisar → testear → ajustar → commit
```

### Prompts clave para cada fase

**Fase 1 — Wallets:**
```
"Create a wallet manager that initializes 4 BSV mainnet wallets
using @bsv/wallet-toolbox with SQLite, each with a unique root 
key from environment variables ORACLE_KEY, INSURER_KEY, 
SHIPOWNER_KEY, VERIFIER_KEY"
```

**Fase 1 — MessageBox:**
```
"Set up MessageBoxClient and PeerPayClient for agent-to-agent 
communication. The Risk Oracle should register its identity and 
listen on 'risk_data_requests' inbox. The Shipowner should be 
able to discover the Oracle's identity key and send a payment 
of 1 satoshi to request risk data."
```

**Fase 2 — AIS:**
```
"Create an AIS WebSocket client that connects to aisstream.io, 
subscribes to BoundingBoxes covering the Strait of Hormuz 
[[56.0, 25.5], [57.5, 27.0]], parses PositionReport messages, 
and maintains a ring buffer of the last 1000 vessel positions. 
Emit events when a vessel enters or exits a defined risk zone."
```

**Fase 2 — Pricing:**
```
"Implement a dynamic pricing engine for maritime micro-insurance.
Input: RiskScore (0-1), hull_value_sats, duration_seconds (60),
pool_utilization (0-1). Output: premium in satoshis.
Formula: hull_value × risk × (duration/86400) × (1 + utilization).
Include unit tests with edge cases."
```

**Fase 4 — UI:**
```
"Create a React dashboard with Leaflet map showing the Persian 
Gulf region (center: [26.0, 54.0], zoom: 6). Add vessel markers 
from a WebSocket feed, color-coded green/yellow/red by risk score.
Overlay semi-transparent polygons for 5 risk zones. Add a sidebar 
with 4 agent status cards showing wallet balance and tx count."
```

---

## Métricas de éxito por fase

| Fase | Métrica | Target | Fail criteria |
|------|---------|--------|---------------|
| 0 | Entorno ready | Todo instalado | No poder crear wallet |
| 1 | First tx | ≥ 1 tx en mainnet | 0 txs al final del día 8 |
| 2 | Agent loop | 4 agentes autónomos | < 3 agentes funcionales |
| 3 | Volume | ≥ 1.5M txs/24h | < 1M txs/24h |
| 4 | Submission | Video + repo + UI | No submit a tiempo |

---

*Hoy es 1 de abril. Tienes 2 días para registrarte y preparar el entorno.*
*El 6 de abril sales a correr. HormuzShield va a hacer ruido.*
