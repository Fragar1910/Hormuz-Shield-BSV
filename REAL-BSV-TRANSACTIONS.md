# Transacciones BSV REALES - Implementación Completa

Este documento explica cómo el sistema HormuzShield implementa transacciones BSV **REALES** en blockchain.

---

## ✅ Estado: IMPLEMENTADO

Las transacciones BSV ahora son **REALES**:
- ✅ Creación de transacciones con @bsv/sdk
- ✅ Gestión de UTXOs desde WhatsOnChain
- ✅ Broadcast a BSV blockchain vía ARC (TAAL)
- ✅ Logging de todas las transacciones
- ✅ Verificación on-chain

---

## 🔧 Cómo Funciona

### 1. BSVTransactionBuilder (`packages/shared/src/bsv-transaction-builder.ts`)

Clase principal que maneja todas las transacciones BSV reales:

```typescript
const builder = new BSVTransactionBuilder({
  privateKeyWif: 'L1abc...xyz',
  network: 'test', // o 'main'
  arcUrl: 'https://api.taal.com/arc',
  arcApiKey: 'tu_api_key'
});

// Enviar pago REAL
const { txid, rawTx } = await builder.sendPayment(
  recipientAddress,
  100, // satoshis
  'Risk score payment' // memo opcional
);

// Verificar en blockchain
// https://test.whatsonchain.com/tx/[txid]
```

**Características:**
- Obtiene UTXOs desde WhatsOnChain API
- Crea transacciones P2PKH reales
- Calcula fees automáticamente
- Gestiona change outputs
- Broadcast vía ARC (TAAL)
- OP_RETURN para memos

### 2. TransactionLogger (`packages/shared/src/transaction-logger.ts`)

Registra TODAS las transacciones en `logs/transactions.jsonl`:

```typescript
const logger = new TransactionLogger('test');

logger.log({
  agent_from: 'oracle',
  agent_to: 'insurer',
  type: 'risk_score_sale',
  txid: 'abc123...',
  amount_sats: 1,
  block_height: null,
  confirmations: 0,
  fees_sats: 1,
  size_bytes: 250,
  metadata: { mmsi: '368207620', risk_score: 0.73 },
  wallet_from_address: 'mxyz...',
  wallet_to_address: 'nabc...',
  verified_on_chain: false
});
```

### 3. Integración en Wallets

Cada agente (Oracle, Insurer, Shipowner, Verifier) usa BSVTransactionBuilder para pagos reales.

**Ejemplo en risk-oracle/src/wallet.ts:**

```typescript
import { BSVTransactionBuilder } from '@hormuz/shared';

export class AgentWallet {
  private txBuilder: BSVTransactionBuilder;
  private txLogger: TransactionLogger;

  constructor(config: AgentWalletConfig) {
    this.privateKey = PrivateKey.fromWif(config.privateKeyWif);
    this.network = config.network;

    // Initialize REAL transaction builder
    this.txBuilder = new BSVTransactionBuilder({
      privateKeyWif: config.privateKeyWif,
      network: config.network,
      arcUrl: process.env.ARC_URL,
      arcApiKey: process.env.ARC_API_KEY
    });

    // Initialize transaction logger
    this.txLogger = new TransactionLogger(config.network);
  }

  async sendDirectPayment(recipientAddress: string, satoshis: number, memo?: string) {
    // Create and broadcast REAL BSV transaction
    const { txid, rawTx } = await this.txBuilder.sendPayment(
      recipientAddress,
      satoshis,
      memo
    );

    // Log transaction
    this.txLogger.log({
      agent_from: 'oracle',
      agent_to: 'insurer',
      type: 'risk_score_sale',
      txid,
      amount_sats: satoshis,
      block_height: null,
      confirmations: 0,
      fees_sats: 1,
      size_bytes: rawTx.length / 2,
      metadata: { memo },
      wallet_from_address: this.address,
      wallet_to_address: recipientAddress,
      verified_on_chain: false
    });

    return { txid, rawTx };
  }
}
```

---

## 🚀 Cómo Usar

### Paso 1: Generar Wallets

```bash
npm run generate-wallets
```

Esto crea `.env` con 4 wallets nuevas.

### Paso 2: Fondear Wallets

**TESTNET (para pruebas locales):**

```bash
# Ver addresses
cat wallets-testnet.json

# Ir al faucet
open https://faucet.bitcoincloud.net/

# Para cada address, solicitar testnet coins

# Verificar balances
npm run check-balances
```

**MAINNET (para hackathon oficial):**

```bash
# Ver addresses
cat wallets-mainnet.json

# Transferir BSV desde exchange o BSV Desktop Wallet:
# - Oracle: 0.05 BSV
# - Insurer: 1.00 BSV
# - Shipowner: 0.10 BSV
# - Verifier: 0.02 BSV
# Total: 1.17 BSV (~$58 USD)

# Verificar balances
BSV_NETWORK=main npm run check-balances
```

### Paso 3: Configurar ARC API Key

```bash
# Obtener API key de TAAL
# 1. Ir a https://console.taal.com
# 2. Crear cuenta
# 3. Generar API key

# Agregar a .env
echo "ARC_API_KEY=tu_api_key_aqui" >> .env
```

### Paso 4: Probar Transacción Real

```bash
# Iniciar Oracle
npm run start:oracle

# En logs, verás:
# [BSV] Transaction broadcasted: abc123def456...
# [TxLogger] Transaction logged to logs/transactions.jsonl

# Verificar en blockchain
open "https://test.whatsonchain.com/tx/abc123def456..."
```

### Paso 5: Test de 1 Hora (Testnet)

```bash
# Iniciar todos los agentes
npm run start:all

# Dejar correr 1 hora

# Generar reporte
npm run generate-evidence-report -- --duration=1h

# Verificar transacciones
npm run verify-sample-txs -- --count=100
```

### Paso 6: Test de 24 Horas (Mainnet)

```bash
# En VPS, cambiar a mainnet
# En .env:
BSV_NETWORK=main
ARC_URL=https://api.taal.com/arc

# Verificar fondeo
npm run check-balances

# Iniciar con PM2
pm2 start ecosystem.config.js

# Esperar 24 horas

# Generar evidencia
npm run generate-evidence-report -- --duration=24h
npm run package-evidence-for-submission
```

---

## 📊 Verificación de Transacciones

### Manual

1. Copiar TXID del log:
   ```bash
   tail logs/transactions.jsonl | jq -r '.txid' | head -1
   ```

2. Abrir en WhatsOnChain:
   - Testnet: https://test.whatsonchain.com/tx/[TXID]
   - Mainnet: https://whatsonchain.com/tx/[TXID]

3. Verificar:
   - ✅ Status: Confirmed
   - ✅ Confirmations: ≥ 1
   - ✅ Inputs/Outputs correctos
   - ✅ Fees razonables (~1 sat)

### Automática

```bash
# Verificar sample de TXIDs
npm run verify-sample-txs -- --count=100

# Salida:
# ✅ 98/100 confirmed on blockchain
# ⏳ 2/100 in mempool
# ❌ 0/100 not found
```

---

## 💰 Gestión de Fondos

### Verificar Balances

```bash
npm run check-balances

# Salida:
# ✅ ORACLE:    0.05000000 BSV (5,000,000 sats)
# ✅ INSURER:   1.00000000 BSV (100,000,000 sats)
# ✅ SHIPOWNER: 0.10000000 BSV (10,000,000 sats)
# ✅ VERIFIER:  0.02000000 BSV (2,000,000 sats)
```

### Re-fondear Durante Test

```bash
# Si una wallet se queda sin fondos durante el test:

# 1. Verificar qué wallet necesita fondos
npm run check-balances

# 2. Transferir BSV a esa address
# (desde BSV Desktop Wallet o exchange)

# 3. Esperar confirmación (~10 min)

# 4. Reiniciar agente
pm2 restart shipowner
```

### Calcular Fondos Necesarios

```bash
# Para 24 horas de operación:
#
# Transacciones proyectadas: 2.5M txs
# Fee promedio: 1 sat/tx
# Total fees: 2.5M sats = 0.025 BSV (~$1.25)
#
# Pagos entre agentes (micropayments):
# - Oracle → Insurer: ~900K txs × 1 sat = 0.009 BSV
# - Shipowner → Insurer: ~540K txs × 1 sat = 0.0054 BSV
# - Etc.
#
# Total estimado: 0.05 - 0.10 BSV (~$5 USD)
#
# Recomendación: Fondear 10x más para seguridad
# Total: 1.17 BSV (~$58 USD)
```

---

## 🐛 Troubleshooting

### Error: "No UTXOs available"

```bash
# Wallet no tiene fondos
npm run check-balances

# Fondear wallet
# Ver Paso 2 arriba
```

### Error: "Insufficient funds"

```bash
# UTXO disponible es muy pequeño
# Necesitas consolidar UTXOs o transferir más fondos

# Ver balance detallado
npm run show-utxos

# Consolidar UTXOs pequeños
npm run consolidate-utxos
```

### Error: "Broadcast failed"

```bash
# Verificar ARC_API_KEY
grep ARC_API_KEY .env

# Verificar conectividad a ARC
curl https://api.taal.com/arc/v1/chain/info \
  -H "Authorization: Bearer $ARC_API_KEY"

# Ver logs de errores
grep "broadcast" logs/errors.log
```

### Error: "Rate limit exceeded"

```bash
# WhatsOnChain tiene rate limits
# Solución: Reducir frecuencia de transacciones temporalmente

# En .env, aumentar intervalos:
POSITION_UPDATE_INTERVAL=60000  # de 30s a 60s
RISK_CALC_INTERVAL=30000        # de 5s a 30s
```

---

## 📈 Volumen de Transacciones

### Proyección para 24 horas

```
Con transacciones REALES:
- Oracle: ~900K txs/24h
- Insurer: ~700K txs/24h
- Shipowner: ~540K txs/24h
- Verifier: ~400K txs/24h
TOTAL: ~2.54M txs/24h (169% del objetivo de 1.5M)
```

### Ajustar Volumen

Si necesitas más transacciones:

```bash
# En .env, reducir intervalos:
POSITION_UPDATE_INTERVAL=10000  # Más frecuente
RISK_CALC_INTERVAL=5000
BATCH_INTERVAL_MS=30000

# Reiniciar agentes
pm2 restart all
```

Si necesitas menos (por fondeo limitado):

```bash
# En .env, aumentar intervalos:
POSITION_UPDATE_INTERVAL=60000
RISK_CALC_INTERVAL=60000
BATCH_INTERVAL_MS=300000  # 5 min

# Reiniciar agentes
pm2 restart all
```

---

## ✅ Checklist de Verificación

Antes del test de 24h:

```
✅ Wallets generadas y fondeadas
✅ ARC_API_KEY configurado
✅ Transacciones de prueba confirmadas en blockchain
✅ Logs escribiéndose correctamente
✅ npm run check-balances muestra fondos suficientes
✅ VPS configurado y accesible
✅ PM2 configurado correctamente
✅ Firewall permite puertos 3001-3004
✅ Sistema de evidencia configurado
✅ Screenshots automáticos funcionando
```

---

## 🎯 Para el Hackathon

**Evidencia que necesitas:**

1. **Reporte de 24h** con 2.5M+ transacciones
2. **1000 TXIDs** verificables en WhatsOnChain
3. **Screenshots** del dashboard cada 2h
4. **Video demo** de 3-5 minutos
5. **Logs completos** en `logs/transactions.jsonl`

**Comando todo-en-uno:**

```bash
npm run package-evidence-for-submission
```

Esto genera `evidence-package.zip` con todo lo necesario para la submission del hackathon.

---

## 📞 Soporte

Si tienes problemas:

1. Ver logs: `pm2 logs`
2. Check balances: `npm run check-balances`
3. Ver errores: `cat logs/errors.log`
4. Test transacción: `npm run test-tx`

**¡Buena suerte en el hackathon! 🚀**
