#!/usr/bin/env ts-node
/**
 * Transfer Funds Between Wallets
 * ================================
 * Transfers BSV from Oracle wallet to other agent wallets
 */

import { PrivateKey, Transaction, P2PKH, ARC, LockingScript } from '@bsv/sdk';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const TESTNET_API = 'https://api.whatsonchain.com/v1/bsv/test';
const SATS_PER_BYTE = 1; // Fee rate for testnet

interface UTXO {
  txid: string;
  vout: number;
  satoshis: number;
  sourceTransaction?: Transaction;
}

async function getUTXOs(address: string): Promise<UTXO[]> {
  try {
    console.log(`\n🔍 Fetching UTXOs for ${address}...`);
    const response = await axios.get(`${TESTNET_API}/address/${address}/unspent`);

    // Get full transaction hex for each UTXO
    const utxosWithTx = await Promise.all(
      response.data.map(async (utxo: any) => {
        try {
          const txHexResponse = await axios.get(`${TESTNET_API}/tx/${utxo.tx_hash}/hex`);
          const txHex = txHexResponse.data;
          const tx = Transaction.fromHex(txHex);

          return {
            txid: utxo.tx_hash,
            vout: utxo.tx_pos,
            satoshis: utxo.value,
            sourceTransaction: tx
          };
        } catch (err) {
          console.error(`   ⚠️  Could not fetch tx ${utxo.tx_hash}`);
          return {
            txid: utxo.tx_hash,
            vout: utxo.tx_pos,
            satoshis: utxo.value
          };
        }
      })
    );

    console.log(`   Found ${utxosWithTx.length} UTXOs`);
    return utxosWithTx;
  } catch (error: any) {
    console.error('   ❌ Error fetching UTXOs:', error.message);
    return [];
  }
}

async function broadcastTransaction(txHex: string): Promise<string> {
  try {
    console.log('\n📡 Broadcasting transaction to testnet...');
    const response = await axios.post(`${TESTNET_API}/tx/raw`, { txhex: txHex });
    return response.data;
  } catch (error: any) {
    console.error('   ❌ Broadcast error:', error.response?.data || error.message);
    throw error;
  }
}

async function transferFunds() {
  console.log('\n═══ HormuzShield - Fund Transfer ═══\n');

  // Source wallet (Oracle)
  const sourceWIF = process.env.ORACLE_PRIVATE_KEY;
  if (!sourceWIF) {
    console.error('❌ ORACLE_PRIVATE_KEY not found in .env');
    process.exit(1);
  }

  const sourcePrivKey = PrivateKey.fromWif(sourceWIF);
  const sourcePubKey = sourcePrivKey.toPublicKey();
  const sourceAddress = sourcePubKey.toAddress('testnet').toString();

  console.log(`📤 Source: Oracle`);
  console.log(`   Address: ${sourceAddress}`);

  // Destination addresses
  // Transferring 2,250,000 additional sats to each (they already have 250k each)
  // Target: 2,500,000 sats per wallet
  const destinations = [
    { name: 'Insurer', address: 'n4VVmqzRFX7XbohS9EfbCX8of1sUYQLmQV', amount: 2250000 },
    { name: 'Shipowner', address: 'moGP9Y8PD7u4D9JD4shreU19hq3WRkFnPz', amount: 2250000 },
    { name: 'Verifier', address: 'mgVtJZPZYJ4XABpsbdTitU2fv6Zg5heHB7', amount: 2250000 }
  ];

  console.log('\n📥 Destinations:');
  destinations.forEach(dest => {
    console.log(`   ${dest.name}: ${dest.address} (${dest.amount} sats)`);
  });

  // Get UTXOs from source
  const utxos = await getUTXOs(sourceAddress);
  if (utxos.length === 0) {
    console.error('\n❌ No UTXOs found for Oracle wallet. Please fund it first.');
    console.log(`\n💡 Fund this address: ${sourceAddress}`);
    console.log('   Faucets:');
    console.log('   - https://faucet.bitcoincloud.net/');
    console.log('   - https://bsvfaucet.net/en');
    console.log('   - https://www.push-the-button.app/');
    process.exit(1);
  }

  // Calculate total input
  const totalInput = utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0);
  const totalOutput = destinations.reduce((sum, dest) => sum + dest.amount, 0);

  console.log(`\n💰 Balance:`);
  console.log(`   Input:  ${totalInput.toLocaleString()} sats`);
  console.log(`   Output: ${totalOutput.toLocaleString()} sats`);

  // Calculate fee manually
  // Rough estimate: 1 sat/byte * ~600 bytes for 1 input + 4 outputs
  const numInputs = utxos.length;
  const numOutputs = destinations.length + 1; // +1 for change
  const estimatedSize = (numInputs * 148) + (numOutputs * 34) + 10;
  const feeSats = estimatedSize * SATS_PER_BYTE;

  const changeAmount = totalInput - totalOutput - feeSats;

  if (changeAmount < 0) {
    console.error(`\n❌ Insufficient funds!`);
    console.log(`   Need: ${totalOutput + feeSats} sats`);
    console.log(`   Have: ${totalInput} sats`);
    console.log(`   Short: ${Math.abs(changeAmount)} sats`);
    process.exit(1);
  }

  console.log(`   Fee:    ${feeSats} sats (~${estimatedSize} bytes)`);
  console.log(`   Change: ${changeAmount.toLocaleString()} sats`);

  // Build transaction
  console.log('\n🔨 Building transaction...');

  const tx = new Transaction();

  // Add inputs
  for (const utxo of utxos) {
    tx.addInput({
      sourceTXID: utxo.txid,
      sourceOutputIndex: utxo.vout,
      sourceTransaction: utxo.sourceTransaction,
      unlockingScriptTemplate: new P2PKH().unlock(sourcePrivKey)
    });
  }

  // Add outputs for destinations
  for (const dest of destinations) {
    tx.addOutput({
      lockingScript: new P2PKH().lock(dest.address),
      satoshis: dest.amount,
      change: false
    });
  }

  // Add change output
  if (changeAmount > 546) { // Dust limit
    tx.addOutput({
      lockingScript: new P2PKH().lock(sourceAddress),
      satoshis: changeAmount,
      change: true
    });
    console.log(`   ✓ Added change output: ${changeAmount} sats`);
  }

  // Sign transaction
  console.log('   ✓ Signing transaction...');
  await tx.sign();

  const txHex = tx.toHex();
  const txid = tx.id('hex');

  console.log(`   ✓ Transaction built`);
  console.log(`   TXID: ${txid}`);

  // Broadcast
  try {
    await broadcastTransaction(txHex);
    console.log('\n✅ Transaction broadcast successful!');
    console.log(`\n🔗 View on blockchain:`);
    console.log(`   https://test.whatsonchain.com/tx/${txid}`);

    console.log('\n📊 Summary:');
    destinations.forEach(dest => {
      console.log(`   ✅ ${dest.name}: ${dest.amount.toLocaleString()} sats sent`);
    });
    console.log(`   💰 Oracle change: ${changeAmount.toLocaleString()} sats`);

    console.log('\n⏳ Wait ~10 min for confirmation, then check balances:');
    console.log('   npm run check-balances');

  } catch (error) {
    console.error('\n❌ Failed to broadcast transaction');
    console.log('\n📋 Transaction hex (you can broadcast manually):');
    console.log(txHex);
  }
}

// Run
transferFunds().catch(console.error);
