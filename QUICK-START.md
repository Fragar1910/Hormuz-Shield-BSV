# ⚡ QUICK START - 15 Minutos al Hackathon

**HormuzShield BSV - 1.5M Transacciones/24h con TESTNET GRATIS**

---

## 🎯 3 Pasos para Iniciar

### 1️⃣ Setup (2 minutos)

```bash
# Generar 4 wallets BSV
npm run generate-wallets

# Copiar configuración optimizada (50 barcos, 1.5M txs/24h)
cp .env.hackathon .env
```

### 2️⃣ Fondear Wallets TESTNET - GRATIS (10 minutos)

```bash
# Ver tus addresses
cat .env | grep PRIVATE_KEY

# Ir al faucet → https://faucet.bitcoincloud.net/

# Para cada wallet, pegar address y solicitar testnet BSV:
# - Oracle:    2× = ~0.1 BSV
# - Insurer:   5× = ~0.5 BSV
# - Shipowner: 3× = ~0.2 BSV
# - Verifier:  1× = ~0.05 BSV

# Verificar fondeo (esperar ~2 min)
npm run check-balances
```

### 3️⃣ Iniciar Sistema (1 minuto)

```bash
# Build
npm run build

# Iniciar 4 agentes + 50 barcos
npm run start:all

# Ver transacciones en tiempo real
tail -f logs/transactions.jsonl
```

---

## ✅ Verificar que Funciona

```bash
# Contar transacciones
cat logs/transactions.jsonl | wc -l

# Ver último TXID
tail -1 logs/transactions.jsonl | jq -r '.txid'

# Verificar en blockchain
# https://test.whatsonchain.com/tx/[TXID]
```

---

## 📊 Qué Esperar

**Después de 1 hora:**
- ~54,000 transacciones
- ~900 txs/minuto
- Todas verificables en blockchain testnet

**Después de 24 horas:**
- **1.5M - 1.7M transacciones** ✅
- 50 barcos operando
- Logs completos en `logs/transactions.jsonl`

---

## 💰 Costo

```
TESTNET: $0 USD (100% GRATIS)
Válido para hackathon: ✅ SÍ
```

---

## 🆘 Problemas?

```bash
# Wallet sin fondos?
→ Ir al faucet de nuevo

# No hay transacciones?
→ Verificar: grep BSV_NETWORK .env
→ Debe decir: BSV_NETWORK=test

# Transacciones lentas?
→ Verificar: grep POSITION_UPDATE_INTERVAL .env
→ Debe ser: 20000 o menos
```

---

## 📚 Más Info

- **Fondeo detallado:** `TESTNET-FUNDING-GUIDE.md`
- **Config completa:** `HACKATHON-READY.md`
- **Cómo funcionan las txs:** `REAL-BSV-TRANSACTIONS.md`

---

## 🎉 ¡Listo!

```
✅ 50 barcos
✅ 1.5M+ transacciones/24h
✅ BSV testnet real
✅ GRATIS
✅ 15 minutos de setup
```

**¡Ahora solo espera 24h y tendrás tu evidencia para el hackathon!** 🚀
