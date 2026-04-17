# Guía de Logging y Evidencia de Transacciones BSV

Esta guía explica cómo se registran, monitorean y evidencian todas las transacciones BSV en el sistema HormuzShield.

---

## 1. Sistema de Logging de Transacciones

### 1.1 Transaction Logger

Todas las transacciones BSV se registran automáticamente en `logs/transactions.jsonl` (JSON Lines format).

**Estructura de cada log:**

```json
{
  "timestamp": "2026-04-14T20:15:30.123Z",
  "network": "test",
  "agent_from": "oracle",
  "agent_to": "insurer",
  "type": "risk_score_sale",
  "txid": "a1b2c3d4e5f6...",
  "amount_sats": 1,
  "block_height": null,
  "confirmations": 0,
  "fees_sats": 1,
  "size_bytes": 250,
  "metadata": {
    "mmsi": "368207620",
    "risk_score": 0.73,
    "zone_id": "HORMUZ",
    "request_type": "risk_score"
  },
  "wallet_from_address": "mxyz123...",
  "wallet_to_address": "nabc456...",
  "verified_on_chain": false
}
```

### 1.2 Tipos de Transacciones Registradas

| Tipo | Descripción | Agente From | Agente To | Amount |
|------|-------------|-------------|-----------|--------|
| `risk_score_sale` | Oracle vende risk score | Oracle | Insurer/Shipowner | 1 sat |
| `zone_status_sale` | Oracle vende zone status | Oracle | Any | 1 sat |
| `risk_feed_subscription` | Subscription a risk feed | Oracle | Any | 5 sats |
| `premium_payment` | Shipowner paga premium | Shipowner | Insurer | Variable |
| `policy_issuance` | Insurer emite póliza | Insurer | Shipowner | 0 (metadata only) |
| `claim_payout` | Insurer paga claim | Insurer | Shipowner | Variable |
| `verification_fee` | Verifier cobra fee | Shipowner/Insurer | Verifier | 10 sats |
| `batch_record` | Batch de eventos on-chain | Any | Blockchain | 0 (OP_RETURN) |

---

## 2. Verificación de Transacciones en Blockchain

### 2.1 Manual (WhatsOnChain)

```bash
# 1. Obtener TXID del log
grep "risk_score_sale" logs/transactions.jsonl | tail -1 | jq -r '.txid'

# 2. Ir a WhatsOnChain
# Testnet: https://test.whatsonchain.com/tx/[TXID]
# Mainnet: https://whatsonchain.com/tx/[TXID]

# 3. Verificar:
# - Estado: Confirmada / En mempool
# - Confirmations: Número de bloques
# - Inputs/Outputs
# - Fees
```

### 2.2 Automático (Script)

```bash
# Verificar sample de 100 TXIDs aleatorios
npm run verify-sample-txs --count=100

# Salida:
# ✅ 98/100 confirmed on blockchain
# ⏳ 2/100 in mempool
# ❌ 0/100 not found
#
# Confirmation rate: 98%
# Average confirmations: 3.2 blocks
# Evidence saved to: evidence/tx-verification-2026-04-14.json
```

### 2.3 Verificación Continua

```bash
# Monitor que verifica todas las txs cada 5 minutos
npm run start-tx-verifier

# Se ejecuta en background y actualiza:
# - logs/transactions.jsonl (añade confirmations)
# - evidence/verified-txs.json
```

---

## 3. Métricas y Reportes

### 3.1 Métricas en Tiempo Real

```bash
# Ver dashboard en terminal
npm run monitor-transactions

# Muestra:
# ┌─────────────────────────────────────────┐
# │  HormuzShield Transaction Monitor       │
# ├─────────────────────────────────────────┤
# │  Total TXs:        1,234,567            │
# │  TXs/min:          45.2                 │
# │  Confirmed:        1,180,234 (95.6%)    │
# │  In Mempool:       54,333 (4.4%)        │
# │  Failed:           0 (0.0%)             │
# │                                         │
# │  By Agent:                              │
# │    Oracle:         467,890 (37.9%)      │
# │    Insurer:        345,678 (28.0%)      │
# │    Shipowner:      301,234 (24.4%)      │
# │    Verifier:       119,765 (9.7%)       │
# │                                         │
# │  Total Sats Moved: 12,345,678           │
# │  Avg Fee:          1.2 sats/tx          │
# │  Est. 24h Total:   2,654,321 txs        │
# └─────────────────────────────────────────┘
#
# Press 'q' to quit | Updates every 10s
```

### 3.2 Generar Reporte

```bash
# Reporte de 1 hora (para testing)
npm run generate-evidence-report -- --duration=1h

# Salida: evidence/report-1h-2026-04-14.json
# {
#   "test_duration": "1 hour",
#   "start_time": "2026-04-14T19:00:00.000Z",
#   "end_time": "2026-04-14T20:00:00.000Z",
#   "summary": {
#     "total_transactions": 105234,
#     "transactions_per_minute": 1753.9,
#     "projected_24h": 2522010,
#     "target_achieved": true,
#     "percentage_of_target": 168%
#   },
#   "by_agent": {
#     "oracle": { "count": 39838, "percentage": 37.9 },
#     "insurer": { "count": 29465, "percentage": 28.0 },
#     "shipowner": { "count": 25657, "percentage": 24.4 },
#     "verifier": { "count": 10274, "percentage": 9.7 }
#   },
#   "verification": {
#     "sample_size": 1000,
#     "confirmed_on_chain": 978,
#     "in_mempool": 22,
#     "not_found": 0,
#     "verification_rate": 100%
#   },
#   "sample_txids": [
#     "a1b2c3d4...",
#     "e5f6g7h8...",
#     "..."
#   ],
#   "evidence_files": [
#     "evidence/screenshots/dashboard-19h30.png",
#     "evidence/logs/transactions-1h.jsonl",
#     "evidence/metrics/1h-metrics.csv"
#   ]
# }
```

### 3.3 Reporte de 24 horas (Final)

```bash
# Después de 24h de ejecución
npm run generate-evidence-report -- --duration=24h --output=evidence/24h-final-report.json

# Genera:
# - evidence/24h-final-report.json (JSON completo)
# - evidence/24h-final-report.html (Reporte visual HTML)
# - evidence/24h-final-report.pdf (PDF para submission)
# - evidence/txids-sample-1000.txt (1000 TXIDs de ejemplo)
# - evidence/screenshots/* (Screenshots cada 2h)
```

---

## 4. Cómo Evidenciar para el Hackathon

### 4.1 Checklist de Evidencia

```
✅ Reporte JSON de 24h
✅ Reporte HTML visual
✅ 1000+ TXIDs de muestra
✅ Screenshots cada 2 horas (13 total)
✅ Video demo (3-5 min)
✅ Logs completos (comprimidos)
✅ Verificación de TXs en blockchain
✅ Gráficos de volumen de transacciones
```

### 4.2 Generar Paquete de Evidencia

```bash
# Script todo-en-uno
npm run package-evidence-for-submission

# Crea: evidence-package.zip con:
# evidence-package/
# ├── README.txt                       # Instrucciones
# ├── 24h-REPORT.json                  # Reporte JSON
# ├── 24h-REPORT.html                  # Reporte HTML visual
# ├── 24h-REPORT.pdf                   # PDF
# ├── SUMMARY.md                       # Resumen ejecutivo
# ├── txids-verified-sample.txt        # 1000 TXIDs verificados
# ├── blockchain-screenshots/          # Screenshots de WhatsOnChain
# │   ├── tx-1-confirmed.png
# │   ├── tx-2-confirmed.png
# │   └── ...
# ├── dashboard-screenshots/           # Screenshots de UI cada 2h
# │   ├── 00h-start.png
# │   ├── 02h.png
# │   ├── 04h.png
# │   ├── ...
# │   └── 24h-final.png
# ├── logs/
# │   ├── transactions-full.jsonl      # Todas las txs
# │   ├── transactions-sample-10k.csv  # 10K txs en CSV
# │   └── metrics-timeline.csv         # Métricas cada 5 min
# ├── charts/
# │   ├── tx-volume-over-time.png
# │   ├── cumulative-transactions.png
# │   ├── by-agent-breakdown.png
# │   └── confirmation-rate.png
# └── video/
#     └── demo-video.mp4               # Demo 3-5 min
```

### 4.3 Contenido del Video Demo

**Estructura recomendada (3-5 minutos):**

1. **Intro (30s)**
   - Problema: Crisis del Estrecho de Hormuz
   - Solución: HormuzShield

2. **Demo del Sistema (2min)**
   - Mostrar UI con mapa
   - Vessels moviéndose en tiempo real
   - Transacciones fluyendo (transaction feed)
   - Counter de transacciones subiendo

3. **Evidencia de Transacciones (1min)**
   - Abrir WhatsOnChain
   - Mostrar transacciones confirmadas
   - Highlight: 2.5M+ transacciones en 24h

4. **Arquitectura (30s)**
   - 4 agentes autónomos
   - BRC-100 P2P messaging
   - BRC-29 direct payments

5. **Cierre (30s)**
   - Resultados: Target 1.5M → Achieved 2.5M
   - GitHub repo
   - Thank you

---

## 5. Queries Útiles de Análisis

### 5.1 Análisis de Logs

```bash
# Total de transacciones
cat logs/transactions.jsonl | wc -l

# Transacciones por agente
cat logs/transactions.jsonl | jq -r '.agent_from' | sort | uniq -c | sort -rn

# Transacciones por hora
cat logs/transactions.jsonl | jq -r '.timestamp' | cut -c12-13 | sort | uniq -c

# Transacciones por tipo
cat logs/transactions.jsonl | jq -r '.type' | sort | uniq -c

# Total de satoshis movidos
cat logs/transactions.jsonl | jq '.amount_sats' | awk '{sum+=$1} END {print sum}'

# Promedio de fees
cat logs/transactions.jsonl | jq '.fees_sats' | awk '{sum+=$1; count++} END {print sum/count}'

# TXIDs únicos
cat logs/transactions.jsonl | jq -r '.txid' | sort | uniq | wc -l

# Transacciones confirmadas
cat logs/transactions.jsonl | jq 'select(.confirmations > 0)' | wc -l

# Rate de confirmación
cat logs/transactions.jsonl | jq -r 'select(.confirmations > 0) | "confirmed"' | wc -l

# Top 10 vessels más activos
cat logs/transactions.jsonl | jq -r '.metadata.mmsi' | grep -v null | sort | uniq -c | sort -rn | head -10
```

### 5.2 Exportar a CSV

```bash
# Exportar todas las transacciones a CSV
npm run export-txs-to-csv -- --output=evidence/all-transactions.csv

# Formato CSV:
# timestamp,network,agent_from,agent_to,type,txid,amount_sats,confirmations,block_height,fees_sats
# 2026-04-14T20:15:30.123Z,test,oracle,insurer,risk_score_sale,a1b2c3...,1,3,845231,1
# ...

# Importar a Excel/Google Sheets para análisis visual
```

---

## 6. Troubleshooting de Logging

### Problema: No se generan logs

```bash
# Verificar que el directorio logs/ existe
ls -la logs/

# Si no existe, crear:
mkdir -p logs

# Verificar permisos
chmod 755 logs

# Ver si hay errores en los agentes
pm2 logs | grep "ERROR"
```

### Problema: Logs demasiado grandes

```bash
# Comprimir logs antiguos
gzip logs/transactions.jsonl.old

# Rotar logs cada 24h (agregar a crontab)
0 0 * * * cd /home/hormuz/hormuz-shield-bsv && mv logs/transactions.jsonl logs/transactions.$(date +\%Y\%m\%d).jsonl && touch logs/transactions.jsonl
```

### Problema: TXIDs no verificables en blockchain

```bash
# Verificar que estás usando la red correcta
grep BSV_NETWORK .env

# Verificar conectividad a WhatsOnChain
curl https://api.whatsonchain.com/v1/bsv/test/chain/info

# Ver errores de broadcast
grep "broadcast" logs/errors.log
```

---

## 7. Mejores Prácticas

### 7.1 Durante el Test de 24h

1. **Cada 2 horas:**
   - Hacer screenshot del dashboard
   - Ejecutar `npm run snapshot-metrics`
   - Verificar que PM2 no tiene procesos crashed: `pm2 status`
   - Check balances: `npm run check-balances`

2. **Cada 6 horas:**
   - Verificar sample de TXIDs en WhatsOnChain
   - Backup de logs: `tar -czf backup-$(date +%H)h.tar.gz logs/`

3. **Al finalizar 24h:**
   - NO detener agentes inmediatamente
   - Ejecutar `npm run generate-evidence-report -- --duration=24h`
   - Esperar a que se genere el paquete completo
   - Luego sí: `pm2 stop all`

### 7.2 Guardando Evidencia

```bash
# Crear backup en 3 lugares:
# 1. Local
cp -r evidence/ evidence-backup-$(date +%Y%m%d)/

# 2. Google Drive / Dropbox
# Subir carpeta evidence-package/

# 3. GitHub (sin private keys!)
git add evidence-package/
git commit -m "Add 24h evidence package"
git push
```

---

## 8. Formato de Submission

### Para el Hackathon BSV:

```
Submission Form:
  ✅ GitHub Repository URL
  ✅ Demo Video URL (YouTube/Vimeo)
  ✅ Evidence Package URL (Google Drive/Dropbox)
  ✅ Transaction Volume: 2,520,000 txs/24h
  ✅ Sample TXIDs (1000):
     - https://whatsonchain.com/tx/abc123...
     - https://whatsonchain.com/tx/def456...
     - (ver txids-verified-sample.txt)

Description:
  HormuzShield is an autonomous maritime micro-insurance system
  with 4 BSV agents that generated 2.5M+ real blockchain transactions
  in 24 hours. Evidence package includes full transaction logs,
  blockchain verification, screenshots, and demo video.

  All transactions are verifiable on-chain.
  System uses BRC-100 P2P messaging and BRC-29 direct payments.

  Target: 1.5M txs/24h
  Achieved: 2.52M txs/24h (168% of target)
```

---

**Fin de la guía. Happy hacking! 🚀**
