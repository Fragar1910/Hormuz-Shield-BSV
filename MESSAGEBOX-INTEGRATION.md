# MessageBox P2P Integration - Plan de Implementación

**Fecha:** 12 Abril 2026
**Estado:** DEFERRED - Implementando Direct Payments primero (BRC-29)
**Prioridad:** Post-MVP (migración futura)
**Alternativa actual:** Direct BSV Payments - Ver `DIRECT-PAYMENTS-ARCHITECTURE.md`

---

## Contexto

Durante la Sesión 2, intentamos integrar @bsv/message-box-client para pagos P2P + BRC-100 identity.

**Problemas encontrados:**
1. Conflictos de versiones de @bsv/sdk entre root y message-box-client
2. WalletClient tiene interface compleja que requiere substrate
3. PeerPayClient API no coincide completamente con documentación del README
4. Tiempo limitado para debugging de TypeScript types

**Decisión:** Para el MVP, priorizar funcionalidad básica sin MessageBox. Integrar en iteración futura.

---

## Approach Actual (MVP)

### Risk Oracle
- ✅ AIS Stream WebSocket funcionando
- ✅ Cálculo de risk scores
- ✅ Batch recording (placeholder)
- ⏳ **Sin pagos P2P por ahora** - enfoque en datos

### Integración entre Agentes (MVP Simplificado)
- Los agentes comparten risk data via HTTP REST endpoints (temporal)
- No hay autenticación P2P (MVP no productivo)
- Foco: demostrar el flujo de datos y cálculo de primas

**Justificación:**
- Permite avanzar rápido con el MVP
- Demuestra el concepto de micro-insurance
- MessageBox se puede integrar después sin cambiar lógica de negocio

---

## Plan de Integración MessageBox (Futuro)

### Fase 1: Environment Setup
```bash
# 1. Resolver conflictos de versiones
npm dedupe @bsv/sdk

# 2. O usar peer dependencies approach
# En risk-oracle/package.json:
{
  "peerDependencies": {
    "@bsv/sdk": "^2.0.13"
  }
}
```

### Fase 2: Wallet Interface Implementation

**Opción A: Usar WalletClient con substrate**
```typescript
import { WalletClient } from '@bsv/sdk';

const wallet = new WalletClient('window.CWI'); // Browser
const wallet = new WalletClient('json-api', 'https://my-wallet-api'); // Server
```

**Opción B: Implementar WalletInterface mínimo** (actual approach)
```typescript
class SimpleWalletInterface implements WalletInterface {
  // Implementar solo métodos usados por MessageBoxClient:
  // - getPublicKey()
  // - createSignature()
  // - verifySignature()
  // - NO necesita createAction() para solo recibir pagos
}
```

### Fase 3: MessageBoxClient Integration

```typescript
import { MessageBoxClient, PeerPayClient } from '@bsv/message-box-client';

// Initialize
const msgBox = new MessageBoxClient({
  walletClient: myWalletInterface,
  host: 'https://messagebox.babbage.systems'
});

await msgBox.init();

// Create PeerPayClient
const peerPay = new PeerPayClient({
  messageBoxClient: msgBox
});
```

### Fase 4: Payment Receiving

**Current API (verificar con version actual):**
```typescript
// Listen for payments
peerPay.listenForIncomingPayments({
  onPayment: async (payment) => {
    // Process payment
    await peerPay.acceptPayment(payment);
  }
});
```

**Alternative API (si listenForIncomingPayments no existe):**
```typescript
// Poll for payments
setInterval(async () => {
  const payments = await peerPay.listIncomingPayments();
  for (const payment of payments) {
    // Process and accept
    await peerPay.acceptPayment(payment);
  }
}, 5000);
```

### Fase 5: Service Discovery (BRC-100)

```typescript
// Advertise service on overlay network
await msgBox.advertiseService({
  serviceName: 'risk-oracle',
  capabilities: ['risk_score', 'zone_status', 'risk_feed']
});

// Discover other services
const insurers = await msgBox.discoverServices({
  serviceName: 'insurer-pool'
});
```

---

## Código de Referencia

### Files
- `bsv-repos/message-box-client/README.md` - Documentación principal
- `bsv-repos/message-box-client/src/MessageBoxClient.ts` - Implementación
- `bsv-repos/message-box-client/src/PeerPayClient.ts` - Payments
- `bsv-repos/message-box-client/src/__tests/` - Teen simple:
```bash
# Buscar ejemplos de uso
find bsv-repos/simple -name "*message*" -o -name 

## Testing Approach

### 1. Unit Tests
```typescript
describe('MessageBox Integration', () => {
  it('should register identity', async () => {
    const wallet = new AgentWallet({ ... });
    const identityKey = await wallet.getIdentityKey();
    expect(identityKey).toBeTruthy();
  });

  it('should send payment', async () => {
    const peerPay = new PeerPayClient({ ... });
    const result = await peerPay.sendPayment({
      recipient: 'public_key_here',
      amount: 1
    });
    expect(result.txid).toBeTruthy();
  });
});
```

### 2. Integration Tests
```typescript
describe('Agent P2P Communication', () => {
  it('should request and receive risk data', async () => {
    // Oracle registers
    const oracle = await createOracle();
    const oracleIdentity = await oracle.getIdentityKey();

    // Insurer discovers oracle
    const insurer = await createInsurer();

    // Insurer sends payment + request
    const result = await insurer.requestRiskScore({
      oracle: oracleIdentity,
      mmsi: '368207620',
      paymentSats: 1
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('aggregateRisk');
  });
});
```

---

## Checklist para Integración

### Antes de empezar:
- [ ] Leer README completo de @bsv/message-box-client
- [ ] Revisar tests de integración en el repo
- [ ] Verificar versiones de @bsv/sdk están alineadas
- [ ] Tener 2 wallets testnet con fondos para testing

### Durante implementación:
- [ ] Implementar WalletInterface mínimo
- [ ] Probar MessageBoxClient.init() exitoso
- [ ] Probar sendMessage() entre 2 agentes
- [ ] Probar sendPayment() con PeerPayClient
- [ ] Implementar payment handlers
- [ ] Testing end-to-end con 2 agentes

### Validación:
- [ ] Identities registradas en overlay network
- [ ] Pagos P2P funcionando en testnet
- [ ] Mensajes recibidos correctamente
- [ ] Metadata de payments parseada correctamente

---

## Alternativas Si MessageBox No Funciona

### Opción 1: Direct BSV Transactions
```typescript
// Crear transacciones BSV directamente con metadata
const tx = new Transaction();
tx.addOutput({
  lockingScript: P2PKH.lock(recipientAddress),
  satoshis: amountSats
});
tx.addOutput({
  lockingScript: OP_RETURN script con metadata,
  satoshis: 0
});
```

**Pros:** Control completo, no dependencias externas
**Cons:** No hay store-and-forward, receptor debe polling blockchain

### Opción 2: HTTP + BSV Payments
```typescript
// Híbrido: HTTP para messaging, BSV para payments
app.post('/request-data', async (req, res) => {
  const { txid, mmsi } = req.body;

  // Verificar payment on-chain
  const payment = await verifyPayment(txid);

  // Retornar data
  res.json({ data: riskScore });
});
```

**Pros:** Simple, funciona hoy
**Cons:** No es descentralizado, requiere servers

### Opción 3: Usar @bsv/simple con ejemplos
```typescript
// Simple puede tener wrappers más fáciles
import { Something } from '@bsv/simple';
```

**Pros:** Posiblemente más simple
**Cons:** Menos documentado

---

## Timeline Estimado

| Tarea | Tiempo | Dependencias |
|-------|--------|--------------|
| Resolver conflictos versiones | 1h | - |
| Implementar WalletInterface | 2h | - |
| Integrar MessageBoxClient | 2h | WalletInterface |
| Integrar PeerPayClient | 2h | MessageBoxClient |
| Testing + debugging | 3h | Todo lo anterior |
| **TOTAL** | **10h** | - |

**Recomendación:** Dedicar 1 sesión completa solo a MessageBox cuando tengamos el MVP básico funcionando.

---

## Recursos

- **Documentación:** https://docs.bsvblockchain.org/
- **BRC-100 (Wallet):** https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md
- **BRC-103 (P2P Auth):** https://github.com/bitcoin-sv/BRCs/blob/master/peer-to-peer/0103.md
- **MessageBox Server:** https://github.com/bitcoin-sv/messagebox-server
- **Discord BSV:** https://discord.com/invite/bsv (canal #dev-support)

---

**Última actualización:** 12 Abril 2026
**Próxima revisión:** Después de completar MVP básico

---

## Notas para el Futuro

1. **Versioning:** Fijar versiones exactas en package.json para evitar conflicts
2. **Testing:** Usar MessageBox Server local para development
3. **Fallback:** Mantener endpoints HTTP como fallback si MessageBox falla
4. **Documentation:** Documentar cada step de integración para futuras referencias

---

**Estado:** 📝 Documentado para implementación futura
**Prioridad actual:** Completar MVP con HTTP REST, luego migrar a MessageBox P2P
