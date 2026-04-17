# Direct BSV Payments Architecture - Hormuz Shield

**Fecha:** 12 Abril 2026
**Estado:** IMPLEMENTED - Risk Oracle MVP
**Estrategia:** Direct P2PKH transactions con BRC-29 derivation

---

## Contexto

Tras intentar integrar @bsv/message-box-client en la Sesión 2, encontramos complejidades técnicas (conflictos de versiones, interfaces complejas) que ralentizaban el desarrollo del MVP.

**Decisión:** Implementar pagos directos BSV basados en el patrón de `@bsv/simple` de bsv-repos.

**Ventajas:**
- ✅ Arquitectura más simple y comprensible
- ✅ No hay dependencias externas complejas
- ✅ Escalable a 1.5M+ transacciones/24h
- ✅ Compatible con BRC-29 (wallet payment protocol)
- ✅ Permite migración futura a MessageBox si es necesario

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                     HORMUZ SHIELD MVP                            │
│                  Direct Payments Architecture                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐                              ┌──────────────┐
│   CLIENTE    │                              │ RISK ORACLE  │
│  (Insurer,   │                              │   (Servidor) │
│  Shipowner)  │                              │              │
└──────┬───────┘                              └──────┬───────┘
       │                                             │
       │ 1. HTTP POST /api/request-payment          │
       │    { requestType, metadata }               │
       ├────────────────────────────────────────────>│
       │                                             │
       │ 2. PaymentRequest                          │
       │    { serverIdentityKey, derivation, sats } │
       │<────────────────────────────────────────────┤
       │                                             │
       │ 3. wallet.sendDirectPayment(request)       │
       │    → Crea tx P2PKH con BRC-29 derivation   │
       │                                             │
       │ 4. HTTP POST /api/receive-payment          │
       │    { tx, senderKey, derivation, metadata } │
       ├────────────────────────────────────────────>│
       │                                             │
       │                                 5. Process payment
       │                                    + Execute handler
       │                                    + Internalize tx
       │                                             │
       │ 6. Response data                           │
       │    { success, response: { data } }         │
       │<────────────────────────────────────────────┤
       │                                             │
```

---

## Componentes Implementados

### 1. DirectPaymentManager (`packages/risk-oracle/src/payments.ts`)

Gestiona la creación y procesamiento de pagos directos.

**Métodos principales:**
- `createPaymentRequest(satoshis, requestType, metadata)`: Genera PaymentRequest con derivación BRC-29
- `registerPaymentHandler(requestType, handler)`: Registra handlers para diferentes tipos de datos
- `processPayment(payment)`: Procesa un pago recibido y ejecuta el handler correspondiente

**Handlers registrados:**
- `risk_score`: Devuelve risk score de un MMSI (1 sat)
- `zone_status`: Devuelve estado agregado de una zona (1 sat)
- `risk_feed`: Devuelve todos los risk scores actuales (5 sats)

### 2. AgentWallet (`packages/risk-oracle/src/wallet.ts`)

Wallet simplificado con soporte para BRC-29 direct payments.

**Métodos clave:**
- `createPaymentRequest({ satoshis, memo })`: Crea request con derivación BRC-29
- `sendDirectPayment(request)`: Crea transacción P2PKH derivada
- `receiveDirectPayment(payment)`: Internaliza pago recibido

**Protocolo BRC-29:**
```typescript
protocolID: [2, '3241645161d8']
derivationPrefix: base64('payment') = 'cGF5bWVudA=='
derivationSuffix: base64(Random(8))
```

### 3. REST API (`packages/risk-oracle/src/index.ts`)

HTTP REST endpoints para comunicación entre agentes.

**Endpoints implementados:**
```
GET  /health                  - Health check
GET  /api/info                - Oracle info + pricing
POST /api/request-payment     - Solicitar payment request
POST /api/receive-payment     - Enviar pago y recibir data
GET  /api/stats               - Estadísticas del oracle
```

### 4. PaymentClient (cliente de ejemplo)

Clase helper para otros agentes que quieran consumir datos del oracle.

**Ejemplo de uso:**
```typescript
const client = new PaymentClient('http://localhost:3001', myWallet);
const riskScore = await client.requestRiskScore('368207620');
```

---

## Flujo de Pago Detallado

### Step 1: Cliente solicita payment request
```typescript
// Cliente: POST /api/request-payment
const response = await fetch('http://oracle:3001/api/request-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    requestType: 'risk_score',
    metadata: { mmsi: '368207620' }
  })
});

// Oracle responde con:
{
  success: true,
  paymentRequest: {
    serverIdentityKey: '02abc...',
    derivationPrefix: 'cGF5bWVudA==',
    derivationSuffix: 'xY7z...',
    satoshis: 1,
    memo: 'Risk data: risk_score'
  },
  requestType: 'risk_score',
  metadata: { mmsi: '368207620' }
}
```

### Step 2: Cliente crea payment transaction
```typescript
// Cliente usa su wallet para crear tx
const payment = await clientWallet.sendDirectPayment(paymentRequest);

// Resultado:
{
  txid: 'abc123...',
  tx: [1, 2, 3, ...],  // transaction bytes
  senderIdentityKey: '03def...',
  derivationPrefix: 'cGF5bWVudA==',
  derivationSuffix: 'xY7z...',
  outputIndex: 0
}
```

### Step 3: Cliente envía payment al oracle
```typescript
// Cliente: POST /api/receive-payment
const dataResponse = await fetch('http://oracle:3001/api/receive-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...payment,
    requestType: 'risk_score',
    metadata: { mmsi: '368207620' }
  })
});

// Oracle responde con los datos solicitados:
{
  success: true,
  response: {
    success: true,
    data: {
      vesselMmsi: '368207620',
      timestamp: 1744639200000,
      zoneId: 'HORMUZ',
      baseRisk: 0.90,
      aggregateRisk: 0.92,
      confidence: 0.85,
      premiumBasisBps: 450
    }
  }
}
```

---

## Escalabilidad: 1.5M Transacciones/24h

### Diseño para Alto Volumen

**Objetivo:** ~17 transacciones/segundo (1.5M / 86400s)

**Estrategias implementadas:**

1. **Payment batching (futuro):**
   - Agrupar múltiples requests en un solo payment
   - Batch processing de handlers
   - Reduce overhead de HTTP/blockchain

2. **Async processing:**
   - REST API es no-bloqueante
   - Handlers son async
   - Risk engine usa buffers + merkle batching

3. **Caching de datos:**
   - Risk scores en memoria (Map)
   - No hay DB queries en hot path
   - Batch flush cada 60s

4. **HTTP pooling:**
   - Express con cluster mode (futuro)
   - Load balancer para múltiples oracles
   - Stateless design permite horizontal scaling

### Métricas de Rendimiento (Estimadas)

```
Single Risk Oracle Instance:
- Max throughput: ~50 tx/s (HTTP overhead)
- Average latency: ~100ms per request
- Memory footprint: ~200MB (10K vessels tracked)

Scaled Setup (30 oracles):
- Total throughput: 1500 tx/s (5.4M tx/24h)
- High availability con load balancer
- Shared AIS stream data
```

---

## Transición a MessageBox (Futuro)

Esta arquitectura permite migración gradual a MessageBox P2P:

1. **Mantener REST API como fallback**
2. **Añadir MessageBox como transport alternativo:**
   ```typescript
   if (messageBoxAvailable) {
     await messageBox.sendPayment(...)
   } else {
     await http.post('/api/receive-payment', ...)
   }
   ```
3. **Migrar agentes uno por uno sin downtime**

Ver `MESSAGEBOX-INTEGRATION.md` para plan detallado de migración futura.

---

## Testing

### Unit Tests (futuro)
```typescript
describe('DirectPaymentManager', () => {
  it('should create payment request with BRC-29 derivation')
  it('should process payment and execute handler')
  it('should reject payment with invalid metadata')
});
```

### Integration Tests (futuro)
```typescript
describe('Payment Flow', () => {
  it('should complete full payment flow: request → pay → receive')
  it('should handle concurrent payments')
  it('should handle payment failures gracefully')
});
```

### Manual Testing (ahora)
```bash
# 1. Start oracle
npm run start:oracle

# 2. Test health endpoint
curl http://localhost:3001/health

# 3. Request payment
curl -X POST http://localhost:3001/api/request-payment \
  -H "Content-Type: application/json" \
  -d '{"requestType":"risk_score","metadata":{"mmsi":"368207620"}}'

# 4. Send payment (requires wallet implementation)
# ... implement client wallet first ...
```

---

## Configuración

### Environment Variables

```bash
# Risk Oracle
ORACLE_PRIVATE_KEY=your_wif_key_here
ORACLE_PORT=3001
AIS_API_KEY=your_ais_api_key
BSV_NETWORK=test

# Pricing (opcional, defaults en código)
RISK_SCORE_PRICE_SATS=1
ZONE_STATUS_PRICE_SATS=1
RISK_FEED_PRICE_SATS=5
```

### Network Requirements

```
Port 3001: Risk Oracle HTTP API
Port 3002: Insurer Pool HTTP API (futuro)
Port 3003: Shipowner Agent HTTP API (futuro)
Port 3004: Claims Verifier HTTP API (futuro)
Port 5173: Web UI (futuro)
```

---

## Limitaciones del MVP

### Implementado
- ✅ Payment request generation (BRC-29)
- ✅ REST API endpoints
- ✅ Payment handler registry
- ✅ Basic wallet interface

### Pendiente (MVP Phase 2)
- ⏳ Actual blockchain transactions (ahora placeholders)
- ⏳ WalletClient integration con @bsv/sdk
- ⏳ Transaction broadcasting via ARC
- ⏳ Payment verification on-chain
- ⏳ Balance queries via WhatsOnChain
- ⏳ Full BRC-29 key derivation con ECDH

### Futuro (Post-MVP)
- 📋 MessageBox P2P integration
- 📋 Payment batching para volumen
- 📋 Cluster mode para horizontal scaling
- 📋 Monitoring + metrics (Prometheus)
- 📋 Rate limiting + DDoS protection

---

## Referencias

### Código Base
- `bsv-repos/simple/src/core/WalletCore.ts` - Direct payment implementation
- `bsv-repos/simple/src/core/__tests__/direct-payment.test.ts` - Test patterns
- `packages/risk-oracle/src/payments.ts` - Nuestra implementación

### Standards
- **BRC-29:** Wallet Payment Protocol
- **BRC-100:** Identity Key Standard
- **BSV SDK:** https://docs.bsvblockchain.org/

### Documentos Relacionados
- `MESSAGEBOX-INTEGRATION.md` - Plan de migración futura a MessageBox
- `IMPLEMENTATION-PLAN.md` - Roadmap general del proyecto
- `hormuz-shield-architecture.md` - Arquitectura completa del sistema

---

**Estado:** ✅ WORKING - Risk Oracle con Direct Payments compilando exitosamente
**Próximo paso:** Implementar Insurer Pool agent con mismo patrón
**Meta:** Completar arquitectura de 4 agentes con pagos directos funcionales

