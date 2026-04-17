# 💰 FONDEAR WALLETS - INSTRUCCIONES INMEDIATAS

**¡Las wallets YA están generadas! Ahora sólo necesitas fondearlas (GRATIS).**

---

## 🎯 TUS ADDRESSES TESTNET (Copiadas de `wallets-addresses.txt`)

```
Oracle (2× solicitudes = ~0.1 BSV):
miUBkwUZDzCtFYT8faqszNh7CkKXSBGueH

Insurer (5× solicitudes = ~0.5 BSV):
n4VVmqzRFX7XbohS9EfbCX8of1sUYQLmQV

Shipowner (3× solicitudes = ~0.2 BSV):
moGP9Y8PD7u4D9JD4shreU19hq3WRkFnPz

Verifier (1× solicitud = ~0.05 BSV):
mgVtJZPZYJ4XABpsbdTitU2fv6Zg5heHB7
```

---

## 📝 PASO A PASO (10 minutos)

### 1. Abrir un Faucet BSV Testnet (GRATIS)

**Opción 1 (Recomendado):**
```
https://faucet.bitcoincloud.net/
```

**Opción 2:**
```
https://bsvfaucet.net/en
```

**Opción 3:**
```
https://www.push-the-button.app/
```

💡 **Tip:** Si uno no funciona, prueba los otros.

### 2. Fondear Oracle (2 veces)

1. Pega esta address en el faucet:
   ```
   miUBkwUZDzCtFYT8faqszNh7CkKXSBGueH
   ```

2. Completa el CAPTCHA

3. Click "Get Testnet BSV"

4. **Espera 2 minutos**

5. **Repite** (segunda solicitud para la misma address)

### 3. Fondear Insurer (5 veces)

1. Pega esta address:
   ```
   n4VVmqzRFX7XbohS9EfbCX8of1sUYQLmQV
   ```

2. Repite el proceso **5 veces** (espera ~2 min entre cada solicitud)

### 4. Fondear Shipowner (3 veces)

1. Pega esta address:
   ```
   moGP9Y8PD7u4D9JD4shreU19hq3WRkFnPz
   ```

2. Repite **3 veces**

### 5. Fondear Verifier (1 vez)

1. Pega esta address:
   ```
   mgVtJZPZYJ4XABpsbdTitU2fv6Zg5heHB7
   ```

2. Sólo 1 solicitud

---

## ✅ VERIFICAR FONDEO

Después de fondear todo (~10 minutos):

```bash
npm run check-balances
```

**Deberías ver:**
```
✅ ORACLE:    0.10000000 BSV (10,000,000 sats)
✅ INSURER:   0.50000000 BSV (50,000,000 sats)
✅ SHIPOWNER: 0.20000000 BSV (20,000,000 sats)
✅ VERIFIER:  0.05000000 BSV (5,000,000 sats)
```

---

## 🚀 INICIAR SISTEMA

Cuando todas las wallets tengan fondos:

```bash
# Build
npm run build

# Iniciar
npm run start:all
```

---

## 💡 TIPS

### Si el Faucet no Funciona

1. **Esperar 15-30 minutos** entre solicitudes de la misma IP
2. **Usar VPN** diferente si es necesario
3. **Probar desde móvil** (diferente IP)

### Si Necesitas Más Fondos Durante el Test

```bash
# Detener sistema
Ctrl+C

# Verificar qué wallet necesita fondos
npm run check-balances

# Fondear de nuevo desde faucet

# Reiniciar
npm run start:all
```

---

## 📊 ¿Cuánto BSV Necesitas?

Para 24 horas con 1.5M transacciones:

```
Fees: ~0.015 BSV (1.5M txs × 1 sat cada)
Pagos entre agentes: ~0.005 BSV
Buffer de seguridad: 10×

Total: ~0.85 BSV (lo que obtienes del faucet GRATIS)
```

---

## ✅ CHECKLIST

```
□ Oracle fondeada (2× desde faucet)
□ Insurer fondeada (5× desde faucet)
□ Shipowner fondeada (3× desde faucet)
□ Verifier fondeada (1× desde faucet)
□ npm run check-balances muestra > 0 sats en todas
□ npm run build completado
□ Listo para npm run start:all
```

---

## 🎉 ¡ESO ES TODO!

**Una vez fondeadas las 4 wallets, corres `npm run start:all` y el sistema empezará a generar transacciones REALES en blockchain!**

Verás en logs:
```
[BSV] Transaction broadcasted: abc123def456...
[TxLogger] Transaction logged to logs/transactions.jsonl
```

**Cada TXID es verificable en:**
```
https://test.whatsonchain.com/tx/[TXID]
```

---

## 📞 ¿Problemas?

```bash
# Ver si .env tiene las claves
grep PRIVATE_KEY .env

# Debe mostrar 4 claves que empiezan con K o L
# Si no, corre: npm run generate-wallets
```

**¡Adelante, fondea y a correr!** 🚀
