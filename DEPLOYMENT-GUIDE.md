# HormuzShield-BSV - Guía Completa de Deployment y Evidencia

**GUÍA PASO A PASO PARA DESPLEGAR EL SISTEMA CON TRANSACCIONES REALES EN BSV**

---

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#1-configuración-inicial)
2. [Generar y Fondear Wallets](#2-generar-y-fondear-wallets)
3. [Configurar Testnet](#3-configurar-testnet)
4. [Prueba Local (1 hora)](#4-prueba-local-1-hora)
5. [Deployment en VPS](#5-deployment-en-vps)
6. [Prueba de 24 horas en Mainnet](#6-prueba-de-24-horas-en-mainnet)
7. [Logging y Evidencia de Transacciones](#7-logging-y-evidencia-de-transacciones)
8. [Monitoreo y Troubleshooting](#8-monitoreo-y-troubleshooting)

---

## 1. Configuración Inicial

### 1.1 Requisitos

```bash
# Sistema operativo
- Ubuntu 22.04 LTS (recomendado para VPS)
- macOS 13+ (para desarrollo local)

# Software
- Node.js 20+
- npm 10+
- Docker 24+ (opcional, para deployment containerizado)
- PM2 (para deployment en VPS)

# Recursos
- VPS: 4 vCPU, 8GB RAM, 50GB SSD
- $200-300 USD en BSV para fondear wallets
- API keys (AIS Stream, ARC)
```

### 1.2 Clonar y Configurar Proyecto

```bash
# 1. Clonar repositorio
git clone https://github.com/tuusuario/hormuz-shield-bsv.git
cd hormuz-shield-bsv

# 2. Instalar dependencias
npm install

# 3. Build
npm run build

# 4. Verificar que todo compila
npm run test:unit
```

---

## 2. Generar y Fondear Wallets

### 2.1 Generar Wallets BSV

**Opción A: Usar Script de Generación (Recomendado)**

```bash
# Generar 4 wallets nuevas
npm run generate-wallets

# Esto crea:
# - 4 private keys en formato WIF
# - Archivo .env.wallets con las keys
# - Archivo wallets-info.json con addresses
```

**Opción B: Usar BSV Desktop Wallet (Manual)**

1. Descargar BSV Desktop Wallet: https://desktop.bsvb.tech
2. Crear 4 wallets diferentes:
   - `HormuzShield-Oracle`
   - `HormuzShield-Insurer`
   - `HormuzShield-Shipowner`
   - `HormuzShield-Verifier`
3. Exportar private keys en formato WIF
4. Copiar a .env (ver sección 2.3)

### 2.2 Obtener BSV para Fondear Wallets

**Para TESTNET (pruebas):**

```bash
# Usar faucet de BSV testnet
# https://faucet.bitcoincloud.net/

# Para cada wallet address:
# 1. Ir al faucet
# 2. Pegar address
# 3. Solicitar testnet coins
# 4. Esperar confirmación (~10 min)

# Verificar balance:
npm run check-balances -- --network=test
```

**Para MAINNET (producción):**

```bash
# Opción 1: Comprar BSV en exchange
# - Coinbase
# - Binance
# - Kraken

# Opción 2: Recibir de otra wallet

# Fondeo recomendado POR WALLET:
# - Risk Oracle: 0.05 BSV (~$2.50)
# - Insurer Pool: 1.00 BSV (~$50) [pool de liquidez]
# - Shipowner: 0.10 BSV (~$5) [pagar premiums]
# - Claims Verifier: 0.02 BSV (~$1)
#
# TOTAL: ~$58.50 USD

# Transferir a cada address:
# 1. Abrir BSV Desktop Wallet o exchange
# 2. Send → pegar address de cada agente
# 3. Amount según tabla arriba
# 4. Confirm
# 5. Esperar confirmación (1-2 bloques, ~10-20 min)
```

### 2.3 Configurar .env

Crear archivo `.env` en la raíz del proyecto:

```bash
cp .env.example .env
nano .env
```

**Contenido de .env:**

```env
# ======================
# BSV Network
# ======================
BSV_NETWORK=test  # Cambiar a 'main' para producción
ARC_URL=https://api.taal.com/arc
ARC_API_KEY=tu_api_key_de_taal  # Obtener en https://console.taal.com

# ======================
# AIS Stream
# ======================
AIS_API_KEY=your_ais_api_key_here

# ======================
# Agent Wallets (WIF format)
# ======================
# IMPORTANTE: Estas son las private keys que generaste

ORACLE_PRIVATE_KEY=L1abc...xyz  # Tu WIF de Oracle
INSURER_PRIVATE_KEY=L2def...xyz  # Tu WIF de Insurer
SHIPOWNER_PRIVATE_KEY=L3ghi...xyz  # Tu WIF de Shipowner
VERIFIER_PRIVATE_KEY=L4jkl...xyz  # Tu WIF de Verifier

# ======================
# Ports
# ======================
ORACLE_PORT=3001
INSURER_PORT=3002
SHIPOWNER_PORT=3003
VERIFIER_PORT=3004
UI_PORT=5173

# ======================
# System Config
# ======================
POOL_CAPACITY_SATS=100000000  # 1 BSV = 100M sats
VERIFICATION_FEE=10
MIN_PREMIUM_SATS=1

# ======================
# Logging & Evidence
# ======================
LOG_LEVEL=info
ENABLE_TX_LOGGING=true
TX_LOG_FILE=./logs/transactions.jsonl
METRICS_LOG_FILE=./logs/metrics.jsonl
EVIDENCE_DIR=./evidence
```

### 2.4 Verificar Fondeo

```bash
# Verificar que todas las wallets tienen fondos
npm run check-balances

# Salida esperada:
# ✅ Oracle: 0.05000000 BSV (5,000,000 sats)
# ✅ Insurer: 1.00000000 BSV (100,000,000 sats)
# ✅ Shipowner: 0.10000000 BSV (10,000,000 sats)
# ✅ Verifier: 0.02000000 BSV (2,000,000 sats)
#
# Total: 1.17 BSV
```

---

## 3. Configurar Testnet

### 3.1 Configuración para Testnet

```bash
# En .env, asegurar:
BSV_NETWORK=test
ARC_URL=https://arc-test.taal.com/arc
```

### 3.2 Obtener Testnet Coins

```bash
# Script automático para fondear desde faucet
npm run fund-testnet-wallets

# O manual:
# 1. Ir a https://faucet.bitcoincloud.net/
# 2. Para cada address en wallets-info.json:
#    - Pegar address
#    - Solicitar coins
#    - Esperar ~10 min
```

### 3.3 Verificar Conexión a Testnet

```bash
# Test de conectividad
npm run test-network-connection

# Debería mostrar:
# ✅ Connected to BSV Testnet
# ✅ ARC endpoint: https://arc-test.taal.com/arc
# ✅ Current block height: 1524389
# ✅ All wallets funded
```

---

## 4. Prueba Local (1 hora)

### 4.1 Iniciar Sistema en Testnet

```bash
# Terminal 1: Iniciar todos los agentes
npm run start:all

# Terminal 2: Iniciar UI
npm run start:ui

# Terminal 3: Monitorear transacciones
npm run monitor-transactions
```

### 4.2 Verificar que Funciona

```bash
# En otro terminal, hacer healthcheck
curl http://localhost:3001/health  # Oracle
curl http://localhost:3002/health  # Insurer
curl http://localhost:3003/health  # Shipowner
curl http://localhost:3004/health  # Verifier

# Verificar UI
open http://localhost:5173
```

### 4.3 Monitorear Transacciones (1 hora)

```bash
# El sistema debería generar transacciones automáticamente
# Monitorear en tiempo real:
tail -f logs/transactions.jsonl

# Ver metrics cada 5 min:
watch -n 300 'npm run show-metrics'

# Después de 1 hora, generar reporte:
npm run generate-evidence-report -- --duration=1h

# Salida esperada en evidence/1h-test-report.json:
# {
#   "duration": "1 hour",
#   "totalTransactions": ~105,000,
#   "byAgent": {
#     "oracle": ~37,500,
#     "insurer": ~29,000,
#     "shipowner": ~22,500,
#     "verifier": ~16,000
#   },
#   "projectedFor24h": ~2,520,000,
#   "evidence": {
#     "txids": [...],
#     "screenshots": [...],
#     "logs": [...]
#   }
# }
```

### 4.4 Verificar Transacciones en Blockchain

```bash
# Ver transacciones en blockchain explorer
npm run view-recent-txs

# Esto abre WhatsOnChain con tus TXIDs
# Ejemplo: https://test.whatsonchain.com/tx/abc123...

# Verificar manualmente algunos TXIDs:
# 1. Copiar TXID del log
# 2. Ir a https://test.whatsonchain.com/
# 3. Pegar TXID
# 4. Verificar que existe on-chain
```

### 4.5 Ajustar Intervalos (si es necesario)

Si después de 1 hora no llegas a ~105K transacciones:

```bash
# Editar configuración en .env
nano .env

# Ajustar:
# POSITION_UPDATE_INTERVAL=10000  # Reducir de 30s a 10s
# RISK_CALC_INTERVAL=5000         # Reducir intervalo de cálculo
# BATCH_INTERVAL_MS=30000         # Reducir de 60s a 30s

# Reiniciar agentes
npm run restart:all
```

---

## 5. Deployment en VPS

### 5.1 Seleccionar VPS

**Providers Recomendados:**
- DigitalOcean: $40/mo (4 vCPU, 8GB RAM)
- AWS EC2: t3.large (~$60/mo)
- Hetzner: €25/mo (4 vCPU, 8GB RAM)

### 5.2 Setup Inicial del VPS

```bash
# 1. SSH al VPS
ssh root@tu-vps-ip

# 2. Actualizar sistema
apt update && apt upgrade -y

# 3. Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 4. Instalar PM2
npm install -g pm2

# 5. Instalar Git
apt install -y git

# 6. Crear usuario no-root
adduser hormuz
usermod -aG sudo hormuz
su - hormuz
```

### 5.3 Deploy del Proyecto

```bash
# Como usuario 'hormuz'
cd ~

# Clonar proyecto
git clone https://github.com/tuusuario/hormuz-shield-bsv.git
cd hormuz-shield-bsv

# Instalar dependencias
npm install

# Build
npm run build

# Copiar .env con tus keys
nano .env
# Pegar configuración de .env local

# Cambiar a mainnet
# BSV_NETWORK=main
# ARC_URL=https://api.taal.com/arc
```

### 5.4 Configurar PM2

```bash
# Verificar ecosystem.config.js
cat ecosystem.config.js

# Iniciar con PM2
pm2 start ecosystem.config.js

# Verificar que todo está corriendo
pm2 status

# Debería mostrar:
# ┌─────┬────────────────┬─────────┬─────────┬─────────┬─────────┐
# │ id  │ name           │ status  │ restart │ uptime  │ cpu     │
# ├─────┼────────────────┼─────────┼─────────┼─────────┼─────────┤
# │ 0   │ risk-oracle    │ online  │ 0       │ 2s      │ 15%     │
# │ 1   │ insurer-pool   │ online  │ 0       │ 2s      │ 12%     │
# │ 2   │ shipowner      │ online  │ 0       │ 2s      │ 10%     │
# │ 3   │ claims-verifier│ online  │ 0       │ 2s      │ 8%      │
# │ 4   │ hormuz-ui      │ online  │ 0       │ 2s      │ 5%      │
# └─────┴────────────────┴─────────┴─────────┴─────────┴─────────┘

# Ver logs
pm2 logs

# Guardar configuración PM2
pm2 save
pm2 startup
```

### 5.5 Configurar Firewall

```bash
# Abrir puertos necesarios
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3001/tcp  # Oracle
sudo ufw allow 3002/tcp  # Insurer
sudo ufw allow 3003/tcp  # Shipowner
sudo ufw allow 3004/tcp  # Verifier
sudo ufw allow 5173/tcp  # UI
sudo ufw enable

# Verificar
sudo ufw status
```

### 5.6 Configurar Nginx (Opcional, para HTTPS)

```bash
# Instalar Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Configurar reverse proxy para UI
sudo nano /etc/nginx/sites-available/hormuz

# Pegar:
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/hormuz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Configurar HTTPS con Let's Encrypt
sudo certbot --nginx -d tu-dominio.com
```

---

## 6. Prueba de 24 horas en Mainnet

### 6.1 Pre-Deployment Checklist

```bash
# 1. Verificar fondeo de wallets
npm run check-balances

# 2. Verificar configuración mainnet
grep BSV_NETWORK .env
# Debe mostrar: BSV_NETWORK=main

# 3. Verificar ARC API key
grep ARC_API_KEY .env

# 4. Test de conectividad
npm run test-network-connection

# 5. Limpiar logs anteriores
rm -rf logs/* evidence/*

# 6. Crear backup de .env
cp .env .env.backup
```

### 6.2 Iniciar 24h Burn Test

```bash
# Timestamp de inicio
date -u +"%Y-%m-%d %H:%M:%S UTC" > evidence/start-time.txt

# Iniciar sistema
pm2 start ecosystem.config.js

# Esperar 2 minutos para que todo inicie
sleep 120

# Verificar que todo está online
pm2 status
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health

# Iniciar monitor de transacciones en background
pm2 start npm --name "tx-monitor" -- run monitor-transactions

# Iniciar captura de screenshots cada 2 horas
pm2 start npm --name "screenshot-capture" -- run capture-screenshots-every-2h
```

### 6.3 Monitoreo Durante 24h

**Cada 2 horas, ejecutar:**

```bash
# 1. Verificar que todos los procesos están up
pm2 status

# 2. Ver últimas transacciones
tail -n 100 logs/transactions.jsonl

# 3. Generar snapshot de métricas
npm run snapshot-metrics -- --output=evidence/metrics-$(date +%H)h.json

# 4. Verificar uso de recursos
pm2 monit

# 5. Verificar balances de wallets (no deberían agotarse)
npm run check-balances
```

**Script Automático de Monitoreo:**

```bash
# Crear cron job para monitoreo cada 2 horas
crontab -e

# Agregar:
0 */2 * * * cd /home/hormuz/hormuz-shield-bsv && npm run health-check-and-snapshot
```

### 6.4 Al Completar 24 horas

```bash
# 1. Timestamp de fin
date -u +"%Y-%m-%d %H:%M:%S UTC" > evidence/end-time.txt

# 2. Generar reporte final completo
npm run generate-evidence-report -- --duration=24h --output=evidence/24h-final-report.json

# 3. Detener captura de screenshots
pm2 stop screenshot-capture

# 4. Exportar todos los logs
tar -czf evidence/logs-24h.tar.gz logs/

# 5. Generar CSV de todas las transacciones
npm run export-txs-to-csv -- --output=evidence/all-transactions.csv

# 6. Crear informe HTML
npm run generate-html-report -- --output=evidence/report.html
```

---

## 7. Logging y Evidencia de Transacciones

### 7.1 Estructura de Logs

Todos los logs se guardan en `./logs/`:

```
logs/
├── transactions.jsonl        # Todas las txs BSV
├── metrics.jsonl             # Métricas del sistema
├── agents/
│   ├── oracle.log           # Logs del Oracle
│   ├── insurer.log          # Logs del Insurer
│   ├── shipowner.log        # Logs del Shipowner
│   └── verifier.log         # Logs del Verifier
└── errors.log               # Todos los errores
```

### 7.2 Formato de Transaction Log

Cada línea en `transactions.jsonl`:

```json
{
  "timestamp": "2026-04-14T19:30:45.123Z",
  "agent": "oracle",
  "type": "risk_score_sale",
  "txid": "abc123def456...",
  "amount_sats": 1,
  "from_agent": "oracle",
  "to_agent": "insurer",
  "block_height": null,
  "confirmations": 0,
  "metadata": {
    "mmsi": "368207620",
    "risk_score": 0.73,
    "zone": "HORMUZ"
  }
}
```

### 7.3 Queries de Evidencia

```bash
# Contar transacciones totales
cat logs/transactions.jsonl | wc -l

# Contar por agente
cat logs/transactions.jsonl | jq -r '.agent' | sort | uniq -c

# Transacciones por hora
cat logs/transactions.jsonl | jq -r '.timestamp' | cut -c12-13 | sort | uniq -c

# Total de satoshis movidos
cat logs/transactions.jsonl | jq '.amount_sats' | awk '{sum+=$1} END {print sum}'

# TXIDs únicos
cat logs/transactions.jsonl | jq -r '.txid' | sort | uniq | wc -l

# Ver últimas 10 transacciones
tail -n 10 logs/transactions.jsonl | jq '.'
```

### 7.4 Verificar Transacciones en Blockchain

```bash
# Script para verificar random TXIDs en WhatsOnChain
npm run verify-sample-txs -- --count=100

# Salida:
# Verificando 100 TXIDs aleatorios...
# ✅ 98/100 confirmadas en blockchain
# ⏳ 2/100 en mempool
# ❌ 0/100 no encontradas
#
# Ejemplos confirmados:
# https://whatsonchain.com/tx/abc123...
# https://whatsonchain.com/tx/def456...
```

### 7.5 Captura de Screenshots

```bash
# Screenshots automáticos cada 2 horas
# Se guardan en evidence/screenshots/

# Captura incluye:
# - Dashboard UI con mapa
# - Transaction counter
# - Agent status panels
# - Recent transactions feed

# Estructura:
evidence/screenshots/
├── 00h-dashboard.png
├── 02h-dashboard.png
├── 04h-dashboard.png
...
├── 22h-dashboard.png
└── 24h-final-dashboard.png
```

### 7.6 Evidencia para Hackathon

Después del test de 24h, generar paquete de evidencia:

```bash
# Script todo-en-uno
npm run package-evidence-for-submission

# Crea:
evidence-package/
├── SUMMARY.md                    # Resumen ejecutivo
├── 24h-report.json               # Reporte completo JSON
├── 24h-report.html               # Reporte HTML visual
├── transactions.csv              # Todas las txs en CSV
├── sample-txids.txt              # 1000 TXIDs de ejemplo
├── blockchain-verification.pdf   # Screenshots de WhatsOnChain
├── screenshots/                  # 13 screenshots (cada 2h)
├── logs.tar.gz                   # Logs completos comprimidos
└── metrics-charts/               # Gráficos de métricas
    ├── tx-volume-over-time.png
    ├── agent-activity.png
    └── cumulative-transactions.png

# Subir a Google Drive/Dropbox
# Incluir link en submission del hackathon
```

---

## 8. Monitoreo y Troubleshooting

### 8.1 Dashboard de Monitoreo

```bash
# Ver status de PM2
pm2 monit

# Ver logs en tiempo real
pm2 logs

# Ver logs de un agente específico
pm2 logs risk-oracle

# Ver métricas del sistema
pm2 describe risk-oracle
```

### 8.2 Problemas Comunes

**Problema: Agente se cae repetidamente**

```bash
# Ver errores
pm2 logs risk-oracle --err

# Reiniciar agente
pm2 restart risk-oracle

# Ver uso de memoria
pm2 describe risk-oracle | grep memory

# Si hay memory leak, aumentar límite en ecosystem.config.js:
max_memory_restart: '1G'  # Aumentar a 1GB
```

**Problema: Transacciones no se están broadcasteando**

```bash
# Verificar conexión a ARC
curl https://api.taal.com/arc/v1/chain/info \
  -H "Authorization: Bearer $ARC_API_KEY"

# Verificar balances
npm run check-balances

# Ver errores de broadcast
grep "broadcast" logs/errors.log
```

**Problema: Wallets se quedan sin fondos**

```bash
# Verificar balances actuales
npm run check-balances

# Transferir más fondos a la wallet que lo necesita
# Usar BSV Desktop Wallet o exchange

# Reiniciar agente después de fondear
pm2 restart shipowner
```

**Problema: No se generan suficientes transacciones**

```bash
# Ver rate actual de txs
npm run show-tx-rate

# Ajustar intervalos en .env:
POSITION_UPDATE_INTERVAL=10000  # Más frecuente
RISK_CALC_INTERVAL=5000
POLICY_RENEWAL_INTERVAL=30000

# Reiniciar todos los agentes
pm2 restart all
```

### 8.3 Comandos Útiles

```bash
# Ver todas las transacciones de últimas 24h
npm run show-tx-summary

# Proyectar volumen para 24h completas
npm run project-24h-volume

# Verificar health de todos los endpoints
npm run health-check-all

# Ver top 10 vessels más activos
cat logs/transactions.jsonl | jq -r '.metadata.mmsi' | sort | uniq -c | sort -rn | head -10

# Exportar métricas para análisis
npm run export-metrics -- --format=csv --output=metrics.csv
```

---

## Resumen de Comandos Rápidos

```bash
# Setup inicial
npm install && npm run build

# Generar wallets
npm run generate-wallets

# Verificar balances
npm run check-balances

# Iniciar sistema (local)
npm run start:all

# Iniciar sistema (VPS con PM2)
pm2 start ecosystem.config.js

# Monitorear transacciones
npm run monitor-transactions

# Generar evidencia
npm run generate-evidence-report -- --duration=24h

# Paquete para submission
npm run package-evidence-for-submission
```

---

## Contacto y Soporte

Si tienes problemas durante el deployment:

1. Revisar logs: `pm2 logs`
2. Verificar .env: `cat .env`
3. Check balances: `npm run check-balances`
4. Ver errores: `cat logs/errors.log`

**Happy Hacking! 🚀**
