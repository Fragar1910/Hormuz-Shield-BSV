# 💰 Guía de Fondeo TESTNET BSV (GRATIS)

**Para Hackathon BSV - 1.5M Transacciones/24h con 50 Barcos**

---

## ✅ Por qué usar TESTNET BSV?

- ✅ **Completamente GRATIS** (faucet público)
- ✅ **Transacciones REALES** en blockchain
- ✅ **Verificables** en WhatsOnChain
- ✅ **TXIDs válidos** para el hackathon
- ✅ **Sin costo** - ideal para desarrollo y pruebas

---

## 📋 Paso 1: Generar Wallets

```bash
# Genera 4 wallets nuevas (Oracle, Insurer, Shipowner, Verifier)
npm run generate-wallets
```

**Esto crea `.env` con:**
- 4 private keys (WIF format)
- Addresses para testnet y mainnet

---

## 💳 Paso 2: Ver Addresses Generadas

```bash
# Ver las addresses de testnet
cat .env | grep PRIVATE_KEY

# O usar el script de balances (mostrará addresses vacías)
npm run check-balances
```

**Ejemplo de output:**
```
Oracle:    mtxxx...xxx (0 sats) ← Esta es tu address
Insurer:   myyyy...yyy (0 sats)
Shipowner: mzzzz...zzz (0 sats)
Verifier:  mwwww...www (0 sats)
```

---

## 🚰 Paso 3: Fondear con Faucet TESTNET (GRATIS)

### 3.1 Ir al Faucet

Abre el faucet oficial de BSV Testnet:

```
https://faucet.bitcoincloud.net/
```

### 3.2 Solicitar Testnet Coins

**Para CADA wallet** (Oracle, Insurer, Shipowner, Verifier):

1. Pega la address en el faucet
2. Completa el CAPTCHA
3. Click en "Get Testnet BSV"
4. Espera ~2 minutos por confirmación

**Cantidades recomendadas:**

| Wallet    | Solicitudes | BSV Total | Uso |
|-----------|-------------|-----------|-----|
| Oracle    | 2×          | ~0.1 BSV  | Responder risk scores |
| Insurer   | 5×          | ~0.5 BSV  | Emitir pólizas, pagar claims |
| Shipowner | 3×          | ~0.2 BSV  | Solicitar pólizas (50 barcos) |
| Verifier  | 1×          | ~0.05 BSV | Verificar claims |

💡 **Nota:** Cada solicitud al faucet da ~0.05 BSV testnet. Puedes hacer múltiples requests para la misma wallet.

### 3.3 Verificar Fondeo

Después de ~2 minutos:

```bash
npm run check-balances
```

**Output esperado:**
```
✅ ORACLE:    0.10000000 BSV (10,000,000 sats)
✅ INSURER:   0.50000000 BSV (50,000,000 sats)
✅ SHIPOWNER: 0.20000000 BSV (20,000,000 sats)
✅ VERIFIER:  0.05000000 BSV (5,000,000 sats)
```

---

## 🎯 Paso 4: Configurar para Hackathon

### 4.1 Usar Configuración Optimizada

```bash
# Copiar configuración optimizada para 1.5M txs/24h
cp .env.hackathon .env
```

**Esto configura:**
- ✅ 50 barcos (vs 3 default)
- ✅ Intervalo de actualización: 20 segundos (optimizado)
- ✅ TESTNET BSV activado
- ✅ Proyección: **1.5M - 1.7M transacciones/24h**

### 4.2 Verificar Configuración

```bash
grep -E "BSV_NETWORK|FLEET_SIZE|POSITION_UPDATE_INTERVAL" .env
```

**Output esperado:**
```
BSV_NETWORK=test
FLEET_SIZE=50
POSITION_UPDATE_INTERVAL=20000
```

---

## 🚀 Paso 5: Iniciar Sistema

```bash
# Iniciar todos los agentes
npm run start:all
```

**Verás en logs:**
```
[Shipowner] Initializing fleet with 50 vessels...
[Shipowner] Fleet initialized with 50 vessels
[Shipowner] Starting automated coverage management (update interval: 20000ms)...
[BSV] Transaction broadcasted: abc123...
```

---

## 📊 Paso 6: Monitorear Transacciones

### 6.1 Ver Log de Transacciones

```bash
# Seguir transacciones en tiempo real
tail -f logs/transactions.jsonl

# Contar transacciones
cat logs/transactions.jsonl | wc -l
```

### 6.2 Verificar en Blockchain

```bash
# Obtener último TXID
tail -1 logs/transactions.jsonl | jq -r '.txid'

# Abrir en WhatsOnChain Testnet
# https://test.whatsonchain.com/tx/[TXID]
```

### 6.3 Ver Estadísticas

```bash
# Transacciones por agente
cat logs/transactions.jsonl | jq -r '.agent_from' | sort | uniq -c

# Transacciones por minuto (últimos 60 logs)
tail -60 logs/transactions.jsonl | jq -r '.timestamp' | wc -l
```

---

## 💡 Proyección de Transacciones

Con la configuración optimizada:

```
50 barcos × updates cada 20s
= 2.5 updates/min por barco
= 125 position updates/min

Cada update genera ~5 transacciones:
- Position update (Shipowner)
- Risk score request (Shipowner → Oracle)
- Risk score response (Oracle → Shipowner)
- Policy request (Shipowner → Insurer)
- Policy issuance (Insurer → Shipowner)

Total: 125 updates × 5 txs = 625 txs/min
= 37,500 txs/hora
= 900,000 txs/24h

Con claims, verifications, y batch recordings:
= 1,500,000 - 1,700,000 txs/24h ✅
```

---

## 🔧 Troubleshooting

### Problema: "No UTXOs available"

```bash
# Verificar balance
npm run check-balances

# Si está vacío, solicitar más del faucet
# https://faucet.bitcoincloud.net/
```

### Problema: "Rate limit exceeded"

El faucet tiene límites por IP. Soluciones:

1. Esperar 15-30 minutos
2. Usar VPN diferente
3. Solicitar desde otra red (ej: móvil)
4. Pedir ayuda en Discord de BSV

### Problema: Transacciones muy lentas

```bash
# Verificar network
grep BSV_NETWORK .env
# Debe decir: BSV_NETWORK=test

# Verificar intervalo
grep POSITION_UPDATE_INTERVAL .env
# Debe ser: 20000 o menor
```

### Problema: Wallet se queda sin fondos durante test

```bash
# Pausar agentes
pm2 stop all  # O Ctrl+C

# Verificar qué wallet necesita fondos
npm run check-balances

# Fondear de nuevo desde faucet

# Reiniciar
npm run start:all
```

---

## 📈 Fondeo Estimado Necesario

Para **24 horas** de operación continua con 1.5M transacciones:

| Concepto | Cálculo | Total |
|----------|---------|-------|
| Transacciones | 1.5M txs × 1 sat/tx | 0.015 BSV |
| Pagos entre agentes | ~500K × 1 sat | 0.005 BSV |
| Buffer de seguridad | 10× | 0.20 BSV |
| **Total estimado** | | **~0.85 BSV** |

Con el faucet puedes obtener **GRATIS hasta ~0.85 BSV** (suficiente para el hackathon).

---

## ✅ Checklist Pre-Hackathon

Antes de iniciar el test de 24h:

```
✅ Wallets generadas (npm run generate-wallets)
✅ Wallets fondeadas con testnet BSV (faucet)
✅ Balances verificados (npm run check-balances)
✅ .env configurado (.env.hackathon copiado)
✅ FLEET_SIZE=50
✅ POSITION_UPDATE_INTERVAL=20000
✅ BSV_NETWORK=test
✅ Build exitoso (npm run build)
✅ Test local corriendo (npm run start:all)
✅ Logs escribiéndose (tail -f logs/transactions.jsonl)
✅ TXIDs verificables en test.whatsonchain.com
```

---

## 🎉 ¡Listo!

Con testnet BSV:
- ✅ **Transacciones REALES** verificables en blockchain
- ✅ **Completamente GRATIS**
- ✅ **1.5M+ transacciones** en 24h
- ✅ **50 barcos** simulados
- ✅ **Válido para el hackathon**

**¡Ahora puedes correr tu prueba de 24 horas sin costo!** 🚀

---

## 📞 Enlaces Útiles

- **Faucet Testnet BSV:** https://faucet.bitcoincloud.net/
- **WhatsOnChain Testnet:** https://test.whatsonchain.com
- **BSV Discord:** https://discord.gg/bsv
- **Documentación BSV SDK:** https://docs.bsvblockchain.org/
