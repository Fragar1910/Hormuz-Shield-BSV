# HormuzShield-BSV - Plan de Implementación MVP

## Estado Actual: 12 Abril 2026

### ✅ Completado

#### Fase 0: Setup Inicial
- [x] Registro en hackathon BSV
- [x] API Key de aisstream.io: (configurada en .env)
- [x] Repos BSV clonados en `bsv-repos/`
- [x] MCP BSV configurado en `.claude/mcp.json`
- [x] Dependencias BSV instaladas (@bsv/sdk, @bsv/wallet-toolbox, @bsv/simple)

#### Estructura Proyecto
- [x] Monorepo con workspaces creado
- [x] Package shared con types y risk-zones implementado
- [x] Estructura de 6 packages definida

### 🔄 En Progreso

#### Package Shared
- [x] types.ts (completo)
- [x] risk-zones.ts (completo)
- [ ] batch-recorder.ts (Merkle tree batching para on-chain)
- [ ] utils.ts (helpers generales)
- [ ] index.ts (exports)

### 📋 Pendiente

#### 1. Completar Package Shared
```bash
packages/shared/src/
  - batch-recorder.ts    # Batching de eventos on-chain
  - risk-calculator.ts   # Motor de cálculo de risk score
  - utils.ts             # Utilidades generales
  - index.ts             # Barrel exports
```

#### 2. Agent 1: Risk Oracle
```bash
packages/risk-oracle/
  src/
    - index.ts           # Entry point
    - ais-client.ts      # WebSocket a aisstream.io
    - risk-engine.ts     # Cálculo de risk scores
    - payment-server.ts  # Express + micropagos
    - wallet.ts          # Wallet BSV del agente
  package.json
  tsconfig.json
```

**Funcionalidad clave:**
- Conectar a aisstream.io con API key
- Filtrar por BoundingBoxes de RISK_ZONES
- Calcular risk scores en tiempo real
- Vender risk data via micropagos (1 sat por query)
- Registrar risk scores on-chain (batching cada 1 min)

**Basarse en:** `mcp-wallet-bsv-main/src/x402/` para protocolo X402

#### 3. Agent 2: Insurer Pool
```bash
packages/insurer-pool/
  src/
    - index.ts
    - pricing-engine.ts  # Ya definido en hormuz-shield-package.md
    - policy-manager.ts  # Emisión y tracking de pólizas
    - pool-treasury.ts   # Gestión del balance del pool
    - claims-handler.ts  # Evaluación de claims
    - wallet.ts
  package.json
  tsconfig.json
```

**Funcionalidad clave:**
- Pricing dinámico basado en risk scores del Oracle
- Emisión de micro-pólizas (60 segundos de cobertura)
- Aceptar premiums via BSV micropagos
- Pagar claims aprobados
- Pool capacity management

**Fórmula de pricing:**
```typescript
premium_sats = hullValueSats × riskScore × (duration/86400) × (1 + poolUtilization)
```

#### 4. Agent 3: Shipowner
```bash
packages/shipowner/
  src/
    - index.ts
    - fleet-simulator.ts # 50 vessels con rutas realistas
    - coverage-manager.ts # Compra automática de pólizas
    - claim-filer.ts     # Detección y filing de claims
    - routes/            # Rutas predefinidas JSON
    - wallet.ts
  package.json
  tsconfig.json
```

**Funcionalidad clave:**
- Simular 50 vessels (20 VLCC, 15 Suezmax, 10 Aframax, 5 LNG)
- Rutas realistas: Ras Tanura → Hormuz → Fujairah
- Actualizar posición cada 10 segundos
- Auto-comprar coverage al entrar en risk zones
- Auto-renovar pólizas mientras en zona
- Detectar incidents y file claims

#### 5. Agent 4: Claims Verifier
```bash
packages/claims-verifier/
  src/
    - index.ts
    - verification-engine.ts # Validación de claims
    - evidence-collector.ts  # Cross-reference AIS data
    - wallet.ts
  package.json
  tsconfig.json
```

**Funcionalidad clave:**
- Recibir claims del Shipowner
- Cross-reference con AIS data histórico
- Query Oracle para risk data del momento del incidente
- Calcular verification score (0.0-1.0)
- Aprobar/rechazar claim
- Cobrar fee por verificación (5 sats)

#### 6. Web UI Dashboard
```bash
packages/web-ui/
  src/
    - App.tsx
    - components/
      - MapView.tsx         # Leaflet map con vessels
      - AgentPanel.tsx      # Status de 4 agentes
      - TxFeed.tsx          # Feed de transacciones
      - MetricsBar.tsx      # Counters principales
    - hooks/
      - useAgentSocket.ts   # WebSocket al backend
    - types.ts
  package.json (Vite + React + Leaflet)
  index.html
```

**Tecnologías:**
- React 18 + TypeScript
- Vite (dev server)
- Leaflet.js (mapa interactivo)
- WebSocket para datos real-time
- Recharts (gráficos de métricas)

**Vista principal:**
- Mapa con Persian Gulf centrado
- Markers de vessels color-coded por risk
- Polygons de risk zones semitransparentes
- Sidebar con status de 4 agentes
- Top bar con transaction counter (objetivo: 1.5M+)

#### 7. Scripts de Orquestación
```bash
scripts/
  - run-all-agents.js      # Arranca los 4 agentes + UI
  - fund-wallets.ts        # Fondea wallets desde desktop wallet
  - generate-routes.ts     # Genera rutas de vessels JSON
  - monitor-txs.ts         # Monitorea volumen de txs
```

#### 8. Configuración Final
```bash
Root/
  - .env.example           # Template de variables
  - README.md              # Instrucciones completas
  - tsconfig.json          # TypeScript config root
  - .gitignore
  - docker-compose.yml     # (opcional) Deploy con Docker
```

### Variables de Entorno (.env.example)

```env
# AIS Stream
AIS_API_KEY=your_ais_api_key_here

# BSV Network
BSV_NETWORK=test  # test | main
ARC_API_URL=https://arc.taal.com

# Agent Wallets (HD root keys)
ORACLE_ROOT_KEY=
INSURER_ROOT_KEY=
SHIPOWNER_ROOT_KEY=
VERIFIER_ROOT_KEY=

# System Config
MIN_PREMIUM_SATS=1
MAX_POLICY_DURATION_SEC=300
POOL_CAPACITY_SATS=100000000
MAX_EXPOSURE_RATIO=0.3
VERIFICATION_THRESHOLD=0.7
BATCH_INTERVAL_MS=60000

# UI
WS_PORT=3001
UI_PORT=5173
```

---

## Orden de Implementación Recomendado

### Sesión 1 (ACTUAL): Fundación
1. ✅ Shared package (types, risk-zones)
2. ⏳ Completar shared (batch-recorder, risk-calculator, utils)
3. ⏳ Risk Oracle básico (wallet + AIS client)

### Sesión 2: Agentes Core
4. Completar Risk Oracle (risk-engine, payment-server)
5. Insurer Pool (pricing, policy-manager)
6. Shipowner (fleet-simulator básico)

### Sesión 3: Claims & UI
7. Claims Verifier (verification-engine)
8. Shipowner (coverage-manager, claim-filer)
9. Web UI (MapView + AgentPanel)

### Sesión 4: Integration & Volume
10. Integración end-to-end de los 4 agentes
11. Scripts de orquestación
12. Ajuste de intervalos para 1.5M+ txs/24h
13. Testing de volumen

### Sesión 5: Polish & Deploy
14. Web UI completo con todos los componentes
15. README + documentación
16. Deploy a VPS
17. 24h burn test
18. Demo video

---

## Checkpoints de Validación

### Checkpoint 1: Shared Package ✅
- [ ] TypeScript compila sin errores
- [ ] Exports están disponibles para otros packages
- [ ] Risk zones calculan correctamente

### Checkpoint 2: Risk Oracle
- [ ] Conecta a aisstream.io exitosamente
- [ ] Recibe position reports reales
- [ ] Calcula risk scores
- [ ] Primer micropago recibido funciona

### Checkpoint 3: Insurer + Shipowner
- [ ] Insurer puede cotizar póliza
- [ ] Shipowner puede pagar premium
- [ ] Póliza se registra on-chain
- [ ] Wallet balances se actualizan correctamente

### Checkpoint 4: Claims Flow
- [ ] Shipowner detecta incident
- [ ] File claim al Verifier
- [ ] Verifier valida con Oracle data
- [ ] Insurer paga claim aprobado

### Checkpoint 5: Volume Test
- [ ] 4 agentes corriendo simultáneamente
- [ ] >= 1.5M txs en ventana de 24h
- [ ] Sin errores de wallet (UTXO fragmentation)
- [ ] Memory leaks bajo control

---

## Recursos de Referencia

### Código Base
- **mcp-wallet-bsv-main/**: Implementación de wallet BSV con X402
  - `src/x402/facilitator-client.ts`: Protocolo X402
  - `src/wallet/manager.ts`: Gestión de wallet
  - `src/bsv/transaction-builder.ts`: Construcción de txs

### Documentación
- **hormuz-shield-architecture.md**: Arquitectura técnica completa
- **hormuz-shield-package.md**: Código consolidado listo para usar
- **hormuz-shield-execution-plan.md**: Timeline 1-17 abril

### BSV Repos de Referencia
- `bsv-repos/ts-sdk/`: BSV TypeScript SDK
- `bsv-repos/simple/`: @bsv/simple ejemplos
- `bsv-repos/message-box-client/`: MessageBox P2P
- `bsv-repos/payment-express-middleware/`: Payment middleware

### APIs Externas
- **AIS Stream**: `wss://stream.aisstream.io/v0/stream`
  - Docs: https://aisstream.io/documentation
  - API Key: (configurada en .env)
- **BSV ARC**: https://arc.taal.com (broadcast txs)

---

## Comandos Útiles

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start individual agents
npm run start:oracle
npm run start:insurer
npm run start:shipowner
npm run start:verifier

# Start all agents + UI
npm run start:all

# Start UI only
npm run start:ui

# Monitor transaction volume
node scripts/monitor-txs.js
```

---

## Métricas de Éxito

| Objetivo | Meta | Estado |
|----------|------|--------|
| Agentes autónomos | 4 | ⏳ 0/4 |
| Wallets BSV | 4 | ⏳ 0/4 |
| Transacciones/24h | >= 1.5M | ⏳ 0 |
| Risk zones monitoreadas | 7 | ✅ Definidas |
| Vessels simulados | 50 | ⏳ 0 |
| UI funcional | 1 | ⏳ 0% |
| Demo video | 1 | ⏳ No |
| Submission | Antes 17 abril | ⏳ No |

---

**Última actualización:** 12 abril 2026, 13:00 UTC
**Próxima sesión:** Completar shared package + Risk Oracle básico
**Deadline hackathon:** 17 abril 2026, 23:59 UTC (5 días restantes)

---

## Innovación: BSV MessageBox P2P + BRC-100 Identity

**IMPORTANTE: NO usar protocolo X402. Usar MessageBox P2P y BRC-100 wallets.**

El proyecto `mcp-wallet-bsv-main` proporciona referencia de wallet management, pero los pagos entre agentes se harán con:

### MessageBox P2P
- Comunicación agente-to-agente vía MessageBox
- Pagos directos BSV sin intermediarios
- Referencias: `bsv-repos/message-box-client/`

### BRC-100 Wallet & Identity
- Cada agente publica su identity key
- Discovery de otros agentes vía BRC-100
- Autenticación basada en claves públicas

**Estrategia de implementación:**
1. Cada agente crea wallet BSV con identity key
2. Agentes se registran en MessageBox con su identity
3. Discovery: query MessageBox por tipo de servicio
4. Pagos: PeerPayClient para transacciones P2P directas
5. Comunicación: MessageBoxClient para mensajes entre agentes

**Repositorios clave:**
- `bsv-repos/message-box-client/`: Implementación MessageBox
- `bsv-repos/simple/`: Ejemplos de BSV Simple (incluye MessageBox)
- `bsv-repos/ts-sdk/`: SDK core de BSV
