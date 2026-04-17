#!/usr/bin/env ts-node
/**
 * Generate BSV Wallets for All Agents
 * ====================================
 */

import { PrivateKey } from '@bsv/sdk';
import * as fs from 'fs';
import * as path from 'path';

const AGENTS = ['ORACLE', 'INSURER', 'SHIPOWNER', 'VERIFIER'];

console.log('\n═══ HormuzShield - BSV Wallet Generator ═══\n');

const wallets: any[] = [];

for (const agent of AGENTS) {
  const privateKey = PrivateKey.fromRandom();
  const publicKey = privateKey.toPublicKey();
  const wif = privateKey.toWif();
  const addressTestnet = publicKey.toAddress('testnet').toString();
  const addressMainnet = publicKey.toAddress().toString();

  wallets.push({ agent, wif, addressTestnet, addressMainnet });
  console.log(`✅ ${agent}: ${addressTestnet}`);
}

const envContent = `# ═══════════════════════════════════════════════════════════════
# HORMUZ SHIELD BSV - Configuration (Generated: ${new Date().toISOString()})
# ═══════════════════════════════════════════════════════════════

# Network Configuration (TESTNET - GRATIS!)
BSV_NETWORK=test

# Broadcast Endpoints (priority order, separados por comas)
# Opciones: whatsonchain, arc, gorillapool
# Default: whatsonchain → arc → gorillapool (WhatsOnChain es GRATIS!)
BSV_BROADCAST_ENDPOINTS=whatsonchain,arc,gorillapool

# ARC Configuration (opcional, solo si quieres usar ARC)
ARC_URL=https://api.taal.com/arc
# ARC_API_KEY=  # Opcional, solo si tienes API key de TAAL

# AIS Stream Configuration (datos reales de barcos)
AIS_API_KEY=\${process.env.AIS_API_KEY || ''}

# ═══════════════════════════════════════════════════════════════
# Agent Private Keys (KEEP THESE SECURE!)
# ═══════════════════════════════════════════════════════════════
${wallets.map(w => `${w.agent}_PRIVATE_KEY=${w.wif}`).join('\n')}

# ═══════════════════════════════════════════════════════════════
# OPTIMIZACIÓN PARA 1.5M TRANSACCIONES/24H
# ═══════════════════════════════════════════════════════════════

# Fleet Configuration
FLEET_SIZE=50  # 50 barcos

# Update Intervals (en milisegundos)
POSITION_UPDATE_INTERVAL=20000  # 20 segundos
RISK_CALC_INTERVAL=20000        # 20 segundos
POLICY_CHECK_INTERVAL=20000     # 20 segundos

# Batch Recording
BATCH_INTERVAL_MS=60000         # Batch cada minuto

# Pool Configuration
POOL_CAPACITY_SATS=100000000    # 1 BSV capacity

# Agent Ports
RISK_ORACLE_PORT=3001
INSURER_PORT=3002
SHIPOWNER_PORT=3003
VERIFIER_PORT=3004
UI_PORT=5173

# MessageBox (BRC-100 P2P)
MESSAGEBOX_BASE_URL=https://messagebox.babbage.systems

# ═══════════════════════════════════════════════════════════════
# TESTNET ADDRESSES (Fund these at https://faucet.bitcoincloud.net/)
# ═══════════════════════════════════════════════════════════════
# Oracle:    ${wallets[0].addressTestnet}
# Insurer:   ${wallets[1].addressTestnet}
# Shipowner: ${wallets[2].addressTestnet}
# Verifier:  ${wallets[3].addressTestnet}
# ═══════════════════════════════════════════════════════════════
`;

fs.writeFileSync('.env', envContent);

// Also save addresses to a separate file for easy reference
const addressesContent = `# TESTNET ADDRESSES - Fund at BSV Testnet Faucet (FREE)
#
# Faucet Options:
# 1. https://faucet.bitcoincloud.net/ (Recommended)
# 2. https://bsvfaucet.net/en
# 3. https://www.push-the-button.app/
#

Oracle (2× requests = ~0.1 BSV):
${wallets[0].addressTestnet}

Insurer (5× requests = ~0.5 BSV):
${wallets[1].addressTestnet}

Shipowner (3× requests = ~0.2 BSV):
${wallets[2].addressTestnet}

Verifier (1× request = ~0.05 BSV):
${wallets[3].addressTestnet}

# MAINNET ADDRESSES (in case you need them)
Oracle:    ${wallets[0].addressMainnet}
Insurer:   ${wallets[1].addressMainnet}
Shipowner: ${wallets[2].addressMainnet}
Verifier:  ${wallets[3].addressMainnet}
`;

fs.writeFileSync('wallets-addresses.txt', addressesContent);

console.log('\n✅ .env file created with full configuration');
console.log('✅ wallets-addresses.txt created with funding instructions\n');
console.log('📋 NEXT STEPS:');
console.log('1. Fund testnet addresses at: https://faucet.bitcoincloud.net/');
console.log('   (Alternatives: https://bsvfaucet.net/en or https://www.push-the-button.app/)');
console.log('2. Check balances: npm run check-balances');
console.log('3. Start system: npm run start:all\n');
