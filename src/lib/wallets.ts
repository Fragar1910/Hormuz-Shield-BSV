/**
 * HormuzShield Oil — Wallet Loader
 * =================================
 * Carga y valida las claves de todos los agentes desde .env.
 * Importa este módulo en cualquier agente del sistema.
 *
 * Usage:
 *   import { wallets, getWallet } from './wallets'
 *   const underwriter = getWallet('UNDERWRITER')
 */

import 'dotenv/config'
import { PrivateKey } from '@bsv/sdk'

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type AgentName = 'UNDERWRITER' | 'ORACLE' | 'VESSEL' | 'CLAIMS' | 'TREASURY'

export interface AgentWallet {
  name: AgentName
  privateKey: PrivateKey
  address: string
  wif: string
}

// ── Carga y validación ────────────────────────────────────────────────────────
function loadWallet(name: AgentName): AgentWallet {
  const wifEnvKey = `${name}_WIF`
  const wif = process.env[wifEnvKey]

  if (!wif) {
    throw new Error(
      `[HormuzShield] Missing env var: ${wifEnvKey}\n` +
      `Run: npx ts-node generate-wallets.ts --save`
    )
  }

  const privateKey = PrivateKey.fromWif(wif)
  const address = privateKey.toAddress()

  return { name, privateKey, address, wif }
}

// ── Wallets exportados ────────────────────────────────────────────────────────
const AGENT_NAMES: AgentName[] = ['UNDERWRITER', 'ORACLE', 'VESSEL', 'CLAIMS', 'TREASURY']

export const wallets: Record<AgentName, AgentWallet> = Object.fromEntries(
  AGENT_NAMES.map(name => [name, loadWallet(name)])
) as Record<AgentName, AgentWallet>

export function getWallet(name: AgentName): AgentWallet {
  return wallets[name]
}

// ── Config de red ─────────────────────────────────────────────────────────────
export const config = {
  network:        process.env.BSV_NETWORK ?? 'testnet',
  arcApiUrl:      process.env.ARC_API_URL ?? 'https://api.taal.com/arc',
  arcApiKey:      process.env.ARC_API_KEY ?? '',
  messageBoxUrl:  process.env.MESSAGEBOX_BASE_URL ?? 'https://messagebox.babbage.systems',
  simVessels:     parseInt(process.env.SIM_VESSELS ?? '50'),
  simDurationH:   parseInt(process.env.SIM_DURATION_HOURS ?? '24'),
  simTargetTx:    parseInt(process.env.SIM_TARGET_TX ?? '2500000'),
  simBatchSize:   parseInt(process.env.SIM_BATCH_SIZE ?? '100'),
}

// ── Diagnóstico rápido ────────────────────────────────────────────────────────
export function printWalletStatus(): void {
  console.log('\n── HormuzShield Wallet Status ───────────────────────────')
  console.log(`Network : ${config.network}`)
  console.log(`ARC URL : ${config.arcApiUrl}`)
  console.log('')
  for (const w of Object.values(wallets)) {
    console.log(`${w.name.padEnd(12)} → ${w.address}`)
  }
  console.log('─────────────────────────────────────────────────────────\n')
}
