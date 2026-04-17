#!/usr/bin/env ts-node
/**
 * Check BSV Wallet Balances
 * ==========================
 * Queries WhatsOnChain API to check balances of all agent wallets
 */

import { PrivateKey } from '@bsv/sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as https from 'https';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const AGENTS = [
  { name: 'ORACLE', key: process.env.ORACLE_PRIVATE_KEY },
  { name: 'INSURER', key: process.env.INSURER_PRIVATE_KEY },
  { name: 'SHIPOWNER', key: process.env.SHIPOWNER_PRIVATE_KEY },
  { name: 'VERIFIER', key: process.env.VERIFIER_PRIVATE_KEY },
];

const network = process.env.BSV_NETWORK || 'test';
const isTestnet = network === 'test';
const wocBaseUrl = isTestnet
  ? 'https://api.whatsonchain.com/v1/bsv/test'
  : 'https://api.whatsonchain.com/v1/bsv/main';

interface Balance {
  confirmed: number;
  unconfirmed: number;
}

async function getBalance(address: string): Promise<Balance> {
  return new Promise((resolve, reject) => {
    const url = `${wocBaseUrl}/address/${address}/balance`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            confirmed: parsed.confirmed || 0,
            unconfirmed: parsed.unconfirmed || 0
          });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function satsToBSV(sats: number): string {
  return (sats / 100_000_000).toFixed(8);
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  HormuzShield - Wallet Balance Check');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Network: ${network.toUpperCase()}`);
  console.log(`API: ${wocBaseUrl}`);
  console.log('');

  let totalConfirmed = 0;
  let totalUnconfirmed = 0;
  const results: Array<{name: string, address: string, balance: Balance}> = [];

  for (const agent of AGENTS) {
    if (!agent.key) {
      console.log(`❌ ${agent.name}: Missing private key in .env`);
      continue;
    }

    try {
      const privateKey = PrivateKey.fromWif(agent.key);
      const publicKey = privateKey.toPublicKey();
      const address = isTestnet
        ? publicKey.toAddress('testnet').toString()
        : publicKey.toAddress().toString();

      console.log(`Checking ${agent.name}...`);
      const balance = await getBalance(address);

      totalConfirmed += balance.confirmed;
      totalUnconfirmed += balance.unconfirmed;

      results.push({ name: agent.name, address, balance });

      const status = balance.confirmed > 0 ? '✅' : '⚠️ ';
      console.log(`  ${status} ${address}`);
      console.log(`     Confirmed:   ${satsToBSV(balance.confirmed)} BSV (${balance.confirmed.toLocaleString()} sats)`);
      if (balance.unconfirmed > 0) {
        console.log(`     Unconfirmed: ${satsToBSV(balance.unconfirmed)} BSV (${balance.unconfirmed.toLocaleString()} sats)`);
      }
      console.log('');

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`❌ ${agent.name}: Error - ${(error as Error).message}`);
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total Confirmed:   ${satsToBSV(totalConfirmed)} BSV`);
  console.log(`Total Unconfirmed: ${satsToBSV(totalUnconfirmed)} BSV`);
  console.log(`Total Balance:     ${satsToBSV(totalConfirmed + totalUnconfirmed)} BSV`);
  console.log('');

  // Check if all wallets are funded
  const allFunded = results.every(r => r.balance.confirmed > 0);
  if (allFunded) {
    console.log('✅ All wallets are funded!');
    console.log('');
    console.log('Ready to start agents:');
    console.log('  npm run start:all');
  } else {
    console.log('⚠️  Some wallets need funding');
    console.log('');
    console.log('Fund wallets at:');
    if (isTestnet) {
      console.log('  Testnet: https://faucet.bitcoincloud.net/');
      console.log('  Alternatives: https://bsvfaucet.net/en or https://www.push-the-button.app/');
    } else {
      console.log('  Mainnet: Use BSV Desktop Wallet or exchange');
    }
    results.filter(r => r.balance.confirmed === 0).forEach(r => {
      console.log(`  ${r.name}: ${r.address}`);
    });
  }
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
