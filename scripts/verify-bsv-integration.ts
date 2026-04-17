#!/usr/bin/env ts-node
/**
 * BSV Transaction Integration Verification Script
 * ================================================
 * Verifies that the BSV transaction builder is properly integrated
 * and can create real blockchain transactions.
 */

import { BSVTransactionBuilder, TransactionLogger } from '../packages/shared/src';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

interface VerificationResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  data?: any;
}

const results: VerificationResult[] = [];

function log(result: VerificationResult) {
  results.push(result);
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${emoji} ${result.step}: ${result.message}`);
  if (result.data) {
    console.log(`   ${JSON.stringify(result.data)}`);
  }
}

async function verifyEnvironmentVariables(): Promise<boolean> {
  const requiredVars = ['ORACLE_PRIVATE_KEY', 'BSV_NETWORK'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    log({
      step: 'Environment Variables',
      status: 'FAIL',
      message: `Missing required variables: ${missing.join(', ')}`,
    });
    return false;
  }

  log({
    step: 'Environment Variables',
    status: 'PASS',
    message: `All required variables present (network: ${process.env.BSV_NETWORK})`,
  });
  return true;
}

async function verifyTransactionBuilder(): Promise<boolean> {
  try {
    const builder = new BSVTransactionBuilder({
      privateKeyWif: process.env.ORACLE_PRIVATE_KEY!,
      network: process.env.BSV_NETWORK as 'main' | 'test',
      arcUrl: process.env.ARC_URL,
      arcApiKey: process.env.ARC_API_KEY,
    });

    const address = builder.getAddress();

    log({
      step: 'Transaction Builder Init',
      status: 'PASS',
      message: `Initialized successfully`,
      data: { address: address.substring(0, 20) + '...' },
    });
    return true;
  } catch (error) {
    log({
      step: 'Transaction Builder Init',
      status: 'FAIL',
      message: (error as Error).message,
    });
    return false;
  }
}

async function verifyBalance(): Promise<boolean> {
  try {
    const builder = new BSVTransactionBuilder({
      privateKeyWif: process.env.ORACLE_PRIVATE_KEY!,
      network: process.env.BSV_NETWORK as 'main' | 'test',
      arcUrl: process.env.ARC_URL,
      arcApiKey: process.env.ARC_API_KEY,
    });

    const balance = await builder.getBalance();
    const totalSats = balance.confirmed + balance.unconfirmed;

    if (totalSats === 0) {
      log({
        step: 'Balance Check',
        status: 'FAIL',
        message: 'Wallet has no funds. Please fund the wallet first.',
        data: { confirmed: balance.confirmed, unconfirmed: balance.unconfirmed },
      });
      return false;
    }

    log({
      step: 'Balance Check',
      status: 'PASS',
      message: `Wallet has sufficient funds`,
      data: {
        confirmed: balance.confirmed,
        unconfirmed: balance.unconfirmed,
        total: totalSats,
        bsv: (totalSats / 100000000).toFixed(8)
      },
    });
    return true;
  } catch (error) {
    log({
      step: 'Balance Check',
      status: 'FAIL',
      message: `Failed to fetch balance: ${(error as Error).message}`,
    });
    return false;
  }
}

async function verifyUTXOs(): Promise<boolean> {
  try {
    const builder = new BSVTransactionBuilder({
      privateKeyWif: process.env.ORACLE_PRIVATE_KEY!,
      network: process.env.BSV_NETWORK as 'main' | 'test',
      arcUrl: process.env.ARC_URL,
      arcApiKey: process.env.ARC_API_KEY,
    });

    const utxos = await builder.getUTXOs();

    if (utxos.length === 0) {
      log({
        step: 'UTXO Check',
        status: 'FAIL',
        message: 'No UTXOs available',
      });
      return false;
    }

    log({
      step: 'UTXO Check',
      status: 'PASS',
      message: `Found ${utxos.length} UTXO(s)`,
      data: {
        count: utxos.length,
        totalSats: utxos.reduce((sum, u) => sum + u.satoshis, 0)
      },
    });
    return true;
  } catch (error) {
    log({
      step: 'UTXO Check',
      status: 'FAIL',
      message: `Failed to fetch UTXOs: ${(error as Error).message}`,
    });
    return false;
  }
}

async function verifyTransactionLogger(): Promise<boolean> {
  try {
    const logger = new TransactionLogger(
      process.env.BSV_NETWORK as 'main' | 'test',
      path.resolve(process.cwd(), 'logs', 'test-transactions.jsonl')
    );

    // Test logging
    logger.log({
      agent_from: 'test',
      agent_to: 'test',
      type: 'verification_test',
      txid: 'test-txid-' + Date.now(),
      amount_sats: 1,
      block_height: null,
      confirmations: 0,
      fees_sats: 1,
      size_bytes: 250,
      metadata: { test: true },
      wallet_from_address: 'test-from',
      wallet_to_address: 'test-to',
      verified_on_chain: false,
    });

    const count = logger.getCount();

    log({
      step: 'Transaction Logger',
      status: 'PASS',
      message: `Logger working correctly`,
      data: { transactionCount: count },
    });
    return true;
  } catch (error) {
    log({
      step: 'Transaction Logger',
      status: 'FAIL',
      message: `Logger failed: ${(error as Error).message}`,
    });
    return false;
  }
}

async function testSmallTransaction(): Promise<boolean> {
  const shouldTest = process.argv.includes('--test-tx');

  if (!shouldTest) {
    log({
      step: 'Test Transaction',
      status: 'SKIP',
      message: 'Skipped (use --test-tx to enable)',
    });
    return true;
  }

  try {
    const builder = new BSVTransactionBuilder({
      privateKeyWif: process.env.ORACLE_PRIVATE_KEY!,
      network: process.env.BSV_NETWORK as 'main' | 'test',
      arcUrl: process.env.ARC_URL,
      arcApiKey: process.env.ARC_API_KEY,
    });

    // Send 1 satoshi to ourselves (safest test)
    const recipientAddress = builder.getAddress();
    const { txid, rawTx } = await builder.sendPayment(
      recipientAddress,
      1,
      'HormuzShield verification test'
    );

    const network = process.env.BSV_NETWORK === 'test' ? 'test.' : '';
    const explorerUrl = `https://${network}whatsonchain.com/tx/${txid}`;

    log({
      step: 'Test Transaction',
      status: 'PASS',
      message: 'Transaction broadcasted successfully',
      data: {
        txid,
        size: rawTx.length / 2,
        explorer: explorerUrl
      },
    });

    console.log(`\n🔗 View on blockchain: ${explorerUrl}\n`);
    return true;
  } catch (error) {
    log({
      step: 'Test Transaction',
      status: 'FAIL',
      message: `Transaction failed: ${(error as Error).message}`,
    });
    return false;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('   BSV Transaction Integration Verification');
  console.log('═══════════════════════════════════════════════\n');

  // Run all verification steps
  const envOk = await verifyEnvironmentVariables();
  if (!envOk) {
    console.log('\n❌ Verification failed: Missing environment variables');
    console.log('Run: npm run generate-wallets');
    process.exit(1);
  }

  await verifyTransactionBuilder();
  await verifyBalance();
  await verifyUTXOs();
  await verifyTransactionLogger();
  await testSmallTransaction();

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('                  SUMMARY');
  console.log('═══════════════════════════════════════════════\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`✅ Passed:  ${passed}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📊 Total:   ${results.length}\n`);

  if (failed > 0) {
    console.log('⚠️  Some verifications failed. See details above.\n');
    process.exit(1);
  }

  console.log('🎉 All verifications passed!\n');
  console.log('Next steps:');
  console.log('  1. npm run start:all     - Start all agents');
  console.log('  2. npm run test:e2e      - Run E2E tests');
  console.log('  3. Check logs/transactions.jsonl for evidence\n');
}

main().catch((error) => {
  console.error('❌ Verification script failed:', error);
  process.exit(1);
});
