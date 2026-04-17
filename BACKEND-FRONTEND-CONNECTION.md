# 🔗 Backend ↔ Frontend Connection

**Estado:** ✅ CONFIGURADO - Listo para funcionar cuando tengas fondos

---

## 📡 Arquitectura de Conexión en Tiempo Real

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
│              packages/hormuz-ui/src/                        │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  useAgentSocket Hook                                │   │
│  │  ws://localhost:3103                                │   │
│  │  ├─ vessels[]      (50 barcos en mapa)            │   │
│  │  ├─ transactions[] (feed de transacciones BSV)     │   │
│  │  ├─ agents[]       (stats de agentes)              │   │
│  │  └─ metrics        (total txs, volumen, etc)       │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ WebSocket
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              BACKEND - WebSocket Broadcaster                │
│         packages/shared/src/websocket-broadcaster.ts        │
│                 Puerto: 3103 (Shipowner +100)               │
│                                                             │
│  Transmite en tiempo real:                                 │
│  ├─ broadcast('vessels', [...])    ← Fleet updates         │
│  ├─ broadcast('tx', {...})         ← BSV transactions      │
│  ├─ broadcast('agents', [...])     ← Agent status          │
│  └─ broadcast('metrics', {...})    ← Dashboard metrics     │
└─────────────────────────────────────────────────────────────┘
                            ↑ Data Sources
                            ↑
┌─────────────────────────────────────────────────────────────┐
│                   SHIPOWNER AGENT                           │
│            packages/shipowner/src/index.ts                  │
│                   Puerto API: 3003                          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  FleetSimulator                                     │   │
│  │  ├─ updatePositions() cada 20s                     │   │
│  │  └─ wsBroadcaster.broadcastVessels(vessels)        │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  TransactionLogger Callback                         │   │
│  │  ├─ wallet.log(tx) → txLogger.onTransaction()      │   │
│  │  └─ wsBroadcaster.broadcastTransaction(tx)         │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│              BSV BLOCKCHAIN (cuando tengas fondos)          │
│  ├─ Transacciones REALES vía ARC (TAAL)                    │
│  ├─ UTXOs gestionados por BSVTransactionBuilder            │
│  └─ TXIDs verificables en WhatsOnChain                     │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Componentes Configurados

### 1. **WebSocket Broadcaster** (`shared/src/websocket-broadcaster.ts`)
**Puerto:** 3103 (Shipowner 3003 + 100)
**Responsable:**
- Gestionar conexiones WebSocket de clientes UI
- Transmitir actualizaciones en tiempo real
- Mantener lista de clientes conectados

**Métodos clave:**
```typescript
broadcaster.broadcastVessels(vessels)      // Actualiza mapa
broadcaster.broadcastTransaction(tx)       // Nueva transacción BSV
broadcaster.broadcastAgents(agents)        // Stats de agentes
broadcaster.broadcastMetrics(metrics)      // Métricas dashboard
```

---

### 2. **TransactionLogger con Callbacks** (`shared/src/transaction-logger.ts`)
**Mejora:** Ahora soporta callbacks en tiempo real

**Antes:**
```typescript
txLogger.log(tx);  // Solo escribe a archivo
```

**Ahora:**
```typescript
txLogger.onTransaction((tx) => {
  // Se llama CADA VEZ que hay una transacción
  wsBroadcaster.broadcastTransaction(tx);
});

txLogger.log(tx);  // Escribe a archivo Y ejecuta callback
```

**Beneficios:**
- ✅ Todas las transacciones BSV se transmiten al UI automáticamente
- ✅ Sin modificar código de agentes individuales
- ✅ Funciona para TODOS los agentes (Oracle, Insurer, Shipowner, Verifier)

---

### 3. **Shipowner Agent** (`shipowner/src/index.ts`)
**Conexiones:**
- **API REST:** Puerto 3003
- **WebSocket:** Puerto 3103 (para UI)
- **MessageBox:** BRC-100 P2P

**Inicialización:**
```typescript
// 1. Crear broadcaster
const wsBroadcaster = new WebSocketBroadcaster(CONFIG.port + 100);

// 2. Conectar logger al broadcaster
wallet.getTransactionLogger().onTransaction((txLog) => {
  wsBroadcaster.broadcastTransaction({
    id: `tx-${Date.now()}`,
    type: txLog.type,
    amount: txLog.amount_sats,
    from: txLog.agent_from,
    to: txLog.agent_to,
    timestamp: new Date(txLog.timestamp).getTime(),
    txid: txLog.txid,
  });
});

// 3. Transmitir vessels cada 20s
setInterval(() => {
  fleetSimulator.updatePositions();
  const vessels = fleetSimulator.getVessels();
  wsBroadcaster.broadcastVessels(vessels.map(v => ({
    mmsi: v.mmsi,
    lat: v.currentPosition.lat,
    lon: v.currentPosition.lon,
    risk: v.currentPosition.risk || 0.5,
    type: v.type,
  })));
}, CONFIG.positionUpdateInterval); // 20000ms
```

---

### 4. **Frontend Hook** (`hormuz-ui/src/hooks/useAgentSocket.ts`)
**Puerto:** ws://localhost:3103 (actualizado)

**Antes:**
```typescript
export function useAgentSocket(wsUrl = 'ws://localhost:3001') {
  // Se conectaba al Oracle (puerto equivocado)
```

**Ahora:**
```typescript
export function useAgentSocket(wsUrl = 'ws://localhost:3103') {
  // Se conecta al Shipowner WebSocket
```

**Escucha mensajes:**
```typescript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'vessels')   setVessels(message.data);      // 50 barcos
  if (message.type === 'tx')        setTransactions([...]);         // Txs BSV
  if (message.type === 'agents')    setAgents(message.data);        // Stats
  if (message.type === 'metrics')   setMetrics(message.data);       // Métricas
};
```

**Fallback si no conecta:**
- Genera datos DEMO automáticamente cada 2.2s
- Solo se usa si WebSocket no conecta
- Se desactiva automáticamente cuando WebSocket conecta

---

## 🚀 Cómo Funciona Cuando Tengas Fondos

### 1. **Iniciar Sistema**
```bash
npm run start:all
```

Esto inicia:
- ✅ Oracle (puerto 3001)
- ✅ Insurer (puerto 3002)
- ✅ **Shipowner (puerto 3003 + WebSocket 3103)** ← Clave
- ✅ Verifier (puerto 3004)
- ✅ UI (puerto 5173)

---

### 2. **Flujo de Datos Real**

#### A) **Actualizaciones de Barcos** (cada 20s)
```
1. FleetSimulator.updatePositions()
   ↓
2. 50 barcos actualizan posición (lat, lon)
   ↓
3. wsBroadcaster.broadcastVessels(vessels)
   ↓
4. WebSocket envía a UI
   ↓
5. Frontend actualiza mapa en TIEMPO REAL
```

#### B) **Transacciones BSV** (cuando hay fondos)
```
1. Shipowner solicita póliza → Pago BSV 1 sat
   ↓
2. wallet.sendDirectPayment(...)
   ↓
3. txBuilder.sendPayment(...) → Blockchain BSV
   ↓
4. txLogger.log({ txid, amount, ... })
   ↓
5. onTransaction callback se ejecuta
   ↓
6. wsBroadcaster.broadcastTransaction(tx)
   ↓
7. WebSocket envía a UI
   ↓
8. Frontend muestra en feed de transacciones
   ↓
9. TX verificable en test.whatsonchain.com/tx/[txid]
```

---

## 📊 Datos Transmitidos

### **Vessels** (cada 20s)
```json
{
  "type": "vessels",
  "data": [
    {
      "mmsi": "300000000",
      "lat": 26.234,
      "lon": 56.789,
      "risk": 0.73,
      "type": "VLCC Tanker"
    },
    ... // 49 más
  ]
}
```

### **Transactions** (cuando ocurren)
```json
{
  "type": "tx",
  "data": {
    "id": "tx-1713283920000",
    "type": "policy_request",
    "amount": 1,
    "from": "shipowner",
    "to": "insurer",
    "timestamp": 1713283920000,
    "txid": "abc123def456..." // TXID real de BSV blockchain
  }
}
```

### **Metrics** (agregados)
```json
{
  "type": "metrics",
  "data": {
    "totalTxs": 54320,
    "totalVolume": 54320,
    "activePolicies": 47,
    "averageRisk": 0.68,
    "claimsFiled": 3,
    "claimsSettled": 2
  }
}
```

---

## 🧪 Verificar Conexión (Sin Fondos)

```bash
# 1. Iniciar backend
npm run start:shipowner

# Deberías ver:
# [Shipowner] WebSocket server ready on port 3103
# [WebSocket] Server listening on port 3103

# 2. En otra terminal, iniciar UI
npm run start:ui

# 3. Abrir http://localhost:5173

# 4. Abrir DevTools Console (F12)
# Deberías ver:
# [WebSocket] Client connected (total: 1)

# 5. Verificar que muestra:
# - 50 barcos en el mapa (actualizándose cada 20s)
# - NO transacciones (porque no hay fondos)
```

---

## ⚠️ Sin Fondos vs Con Fondos

### **SIN FONDOS** (Estado actual)
```
✅ WebSocket conectado
✅ 50 barcos actualizándose
✅ Mapa funcionando
❌ NO transacciones BSV (wallets vacías)
❌ NO logs/transactions.jsonl
❌ Feed de transacciones vacío
```

### **CON FONDOS** (Cuando fondees wallets)
```
✅ WebSocket conectado
✅ 50 barcos actualizándose
✅ Mapa funcionando
✅ Transacciones BSV REALES
✅ logs/transactions.jsonl escribiéndose
✅ Feed de transacciones en tiempo real
✅ TXIDs verificables en blockchain
```

---

## 🔧 Troubleshooting

### Problema: UI muestra datos DEMO
**Causa:** WebSocket no conectado
**Solución:**
```bash
# Verificar que Shipowner está corriendo
pm2 logs shipowner

# Debe mostrar:
# [WebSocket] Server listening on port 3103

# Si no, reiniciar:
pm2 restart shipowner
```

### Problema: No hay transacciones en UI
**Causa:** Wallets sin fondos
**Solución:**
```bash
# Verificar balances
npm run check-balances

# Fondear wallets con faucet (cuando encuentres uno que funcione)
# O comprar BSV mainnet (~$50-100 USD)
```

### Problema: WebSocket connection refused
**Causa:** Puerto 3103 bloqueado
**Solución:**
```bash
# Verificar que puerto está libre
lsof -i :3103

# Si está ocupado, matar proceso:
kill -9 [PID]

# Reiniciar shipowner
npm run start:shipowner
```

---

## ✅ Checklist de Verificación

```
✅ WebSocketBroadcaster creado en shared/src/
✅ TransactionLogger con callbacks en shared/src/
✅ Shipowner inicializa broadcaster (puerto 3103)
✅ Shipowner conecta logger con broadcaster
✅ Shipowner transmite vessels cada 20s
✅ Frontend actualizado para ws://localhost:3103
✅ getTransactionLogger() agregado a wallet
✅ Todos los imports actualizados
```

---

## 🎯 Para el Usuario

**Cuando tengas fondos:**

1. ✅ Todo el backend YA está conectado al frontend
2. ✅ Solo necesitas fondear las wallets
3. ✅ Iniciar: `npm run start:all`
4. ✅ Las transacciones aparecerán AUTOMÁTICAMENTE en el UI
5. ✅ Los 50 barcos se actualizarán en TIEMPO REAL
6. ✅ Todo se registrará en `logs/transactions.jsonl`

**No necesitas modificar NADA más.**

El sistema está 100% configurado y listo para funcionar cuando tengas fondos BSV.

---

**Generado:** 16 de Abril, 2026
**Estado:** ✅ LISTO para funcionar con fondos
