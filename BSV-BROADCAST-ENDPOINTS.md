# 📡 BSV Broadcast Endpoints - Alternativas a ARC

**Actualizado:** 16 de Abril, 2026

---

## 🎯 Opciones Disponibles

### 1. **WhatsOnChain** (⭐ RECOMENDADO - GRATIS)

**Ventajas:**
- ✅ **100% GRATIS** hasta 3 requests/segundo
- ✅ **Sin API Key** requerida
- ✅ Testnet y Mainnet disponibles
- ✅ Endpoints públicos

**Endpoints:**
```
Mainnet:  POST https://api.whatsonchain.com/v1/bsv/main/tx/raw
Testnet:  POST https://api.whatsonchain.com/v1/bsv/test/tx/raw
```

**Ejemplo:**
```bash
curl -X POST https://api.whatsonchain.com/v1/bsv/test/tx/raw \
  -H "Content-Type: application/json" \
  -d '{"txhex": "01000000..."}'

# Respuesta:
# "abc123def456..." (txid)
```

**Límites:**
- 3 requests/segundo (gratis)
- 10-40 req/s (planes pagos)

---

### 2. **ARC (TAAL)**

**Ventajas:**
- ✅ Oficial de TAAL
- ✅ Alta confiabilidad
- ✅ Soporte empresarial

**Desventajas:**
- ⚠️ Requiere API Key (gratis pero necesitas registrarte)
- ⚠️ Rate limits estrictos

**Endpoints:**
```
Mainnet: https://api.taal.com/arc
Testnet: https://api.taal.com/arc (mismo endpoint, diferente red en headers)
```

**Ejemplo:**
```bash
curl -X POST https://api.taal.com/arc/v1/tx \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rawTx": "01000000..."}'
```

**Registrarse:**
- https://console.taal.com
- Plan gratuito disponible

---

### 3. **ARCADE** (Next-gen para Teranode)

**Ventajas:**
- ✅ Compatible con ARC (drop-in replacement)
- ✅ Preparado para Teranode
- ✅ P2P gossip support

**Estado:**
- ⚠️ Aún en desarrollo/beta
- ⚠️ Requiere self-hosting

**GitHub:**
- https://github.com/bsv-blockchain/arcade

**Uso:**
- Clonar repo
- Correr localmente con Docker
- API compatible con ARC

---

### 4. **GorillaPool**

**Ventajas:**
- ✅ Mining pool con broadcast público
- ✅ API simple

**Endpoints:**
```
https://mapi.gorillapool.io/mapi/tx
```

**Ejemplo:**
```bash
curl -X POST https://mapi.gorillapool.io/mapi/tx \
  -H "Content-Type: application/json" \
  -d '{"rawtx": "01000000..."}'
```

---

### 5. **CoinEx Explorer** (Broadcast Manual)

**Ventajas:**
- ✅ 100% gratis
- ✅ Web UI para testing

**Desventajas:**
- ⚠️ No tiene API pública (solo web UI)

**URL:**
- https://explorer.coinex.com/bsv/tool/broadcast

**Uso:**
- Solo para testing manual
- No apto para aplicaciones automáticas

---

## 🔧 Implementación Multi-Endpoint

Voy a actualizar `BSVTransactionBuilder` para soportar múltiples endpoints con fallback automático:

### Configuración `.env`
```bash
# Broadcast Endpoints (en orden de prioridad)
BSV_BROADCAST_ENDPOINTS=whatsonchain,arc,gorillapool

# API Keys (opcional)
ARC_API_KEY=your_taal_api_key  # Solo si usas ARC
```

### Fallback Automático
```typescript
// Intenta broadcast en este orden:
1. WhatsOnChain (gratis, sin API key)
2. ARC (si tienes API key)
3. GorillaPool (backup)
```

---

## 📊 Comparación

| Endpoint      | Gratis | API Key | Testnet | Mainnet | Rate Limit    |
|---------------|--------|---------|---------|---------|---------------|
| WhatsOnChain  | ✅     | ❌      | ✅      | ✅      | 3 req/s       |
| ARC (TAAL)    | ✅     | ✅      | ✅      | ✅      | Variable      |
| ARCADE        | ✅     | ❌      | ✅      | ✅      | Self-hosted   |
| GorillaPool   | ✅     | ❌      | ❌      | ✅      | No publicado  |
| CoinEx        | ✅     | ❌      | ✅      | ✅      | Solo manual   |

---

## ✅ Recomendación para Hormuz Shield

### Para Desarrollo/Testing:
```
1º WhatsOnChain Testnet (gratis, sin API key)
2º Fallback a ARC si tienes API key
```

### Para Producción:
```
1º ARC (más confiable, soporte comercial)
2º Fallback a WhatsOnChain
3º Fallback a GorillaPool
```

---

## 🚀 Próximos Pasos

Voy a actualizar `BSVTransactionBuilder` para:
1. ✅ Soportar múltiples endpoints
2. ✅ Fallback automático si uno falla
3. ✅ WhatsOnChain como default (gratis)
4. ✅ Sin necesidad de API key para empezar

**¿Quieres que implemente esto ahora?**

---

**Generado:** 16 de Abril, 2026
**Estado:** Documentación completa de opciones
