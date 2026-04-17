#!/usr/bin/env node
/**
 * Claims Verifier - Main Entry Point
 * Independent verification of insurance claims via BRC-100
 *
 * Architecture: BRC-100 MessageBox P2P + BRC-29 Direct Payments
 */

import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AgentWallet } from './wallet.js';
import { MessageBoxManager, AgentMessage } from '@hormuz/shared';
import { VerificationEngine } from './verification-engine.js';

// Load environment variables from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../..', '.env') });

// Validate environment variables
const REQUIRED_ENV = ['VERIFIER_PRIVATE_KEY'];
for (const envVar of REQUIRED_ENV) {
  if (!process.env[envVar]) {
    console.error(`[Verifier] ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const CONFIG = {
  privateKeyWif: process.env.VERIFIER_PRIVATE_KEY!,
  network: (process.env.BSV_NETWORK || 'test') as 'main' | 'test',
  port: parseInt(process.env.VERIFIER_PORT || '3004'),
  verificationFeeSats: parseInt(process.env.VERIFICATION_FEE || '10'),
};

console.log('═══════════════════════════════════════════════════');
console.log('  HORMUZ SHIELD - CLAIMS VERIFIER AGENT');
console.log('  BRC-100 P2P + BRC-29 Direct Payments');
console.log('═══════════════════════════════════════════════════');
console.log(`Network: ${CONFIG.network}`);
console.log(`API Port: ${CONFIG.port}`);
console.log(`Verification Fee: ${CONFIG.verificationFeeSats} sats`);
console.log('═══════════════════════════════════════════════════\n');

async function main() {
  try {
    // Initialize wallet
    console.log('[Verifier] Initializing wallet...');
    const wallet = new AgentWallet({
      privateKeyWif: CONFIG.privateKeyWif,
      network: CONFIG.network,
    });
    console.log(`[Verifier] Wallet address: ${wallet.getAddress()}`);
    console.log(`[Verifier] Identity key: ${wallet.getIdentityKey().substring(0, 32)}...\n`);

    // Initialize MessageBox Manager (BRC-100) - Optional
    console.log('[Verifier] Initializing MessageBox (BRC-100) for P2P...');
    let messageBox: MessageBoxManager | null = null;
    try {
      messageBox = new MessageBoxManager({
        walletClient: wallet.getClient(),
        serviceType: 'claims-verifier',
        messageBoxHost: process.env.MESSAGEBOX_BASE_URL || 'https://messagebox.babbage.systems',
        network: CONFIG.network === 'main' ? 'mainnet' : 'testnet',
      });
      await messageBox.init();
      console.log('[Verifier] ✅ MessageBox P2P ready');
      console.log(`[Verifier] BRC-100 Identity: ${messageBox.getIdentityKey().substring(0, 32)}...\n`);
    } catch (error: any) {
      console.warn('[Verifier] ⚠️  MessageBox unavailable:', error.message);
      console.warn('[Verifier] Continuing with REST API only');
      console.warn('[Verifier] Manual verification via REST will still work\n');
      messageBox = null;
    }

    // Initialize verification engine
    console.log('[Verifier] Initializing verification engine...');
    const verificationEngine = new VerificationEngine();
    console.log('[Verifier] Verification engine ready\n');

    // =========================================================================
    // BRC-100 MessageBox P2P Handlers (only if available)
    // =========================================================================

    if (messageBox) {
      console.log('[Verifier] Setting up MessageBox P2P listeners...');

      // Listen for claim verification requests
      await messageBox.listenForLiveMessages('verification_requests', async (message: AgentMessage) => {
        console.log(`[MessageBox] Received ${message.type} from ${message.from.substring(0, 20)}...`);

        try {
          if (message.type === 'claim_filed') {
            const claim = message.payload;

            console.log(`[Verifier] Verifying claim ${claim.claimId} for vessel ${claim.mmsi}`);

            // Perform verification
            const verificationResult = await verificationEngine.verifyClaim(claim, claim.riskData);

            // Send verification result back to insurer
            const responseMessage: AgentMessage = {
              from: messageBox!.getIdentityKey(),
              to: message.from,
              type: 'claim_verification',
              payload: {
                claimId: claim.claimId,
                verificationResult,
                verifierIdentity: messageBox!.getIdentityKey(),
                verificationFee: CONFIG.verificationFeeSats
              },
              timestamp: Date.now()
            };

            await messageBox!.sendLiveMessage(message.from, 'verification_results', responseMessage);

            console.log(
              `[Verifier] Verification complete: ${claim.claimId} - ${verificationResult.recommendation} (score: ${(verificationResult.verificationScore * 100).toFixed(1)}%)`
            );
          }
        } catch (error) {
          console.error('[MessageBox] Error processing verification request:', error);
        }
      });

      console.log('[Verifier] MessageBox P2P listeners active\n');
    } else {
      console.log('[Verifier] MessageBox P2P disabled - REST API available for manual verification\n');
    }

    // =========================================================================
    // REST API Server
    // =========================================================================

    const app = express();
    app.use(express.json());

    // Health check
    app.get('/health', (_, res) => {
      res.json({
        status: 'ok',
        service: 'claims-verifier',
        identityKey: wallet.getIdentityKey(),
        address: wallet.getAddress(),
      });
    });

    // Get verifier info
    app.get('/api/info', (_, res) => {
      res.json({
        identityKey: wallet.getIdentityKey(),
        address: wallet.getAddress(),
        network: CONFIG.network,
        verificationFeeSats: CONFIG.verificationFeeSats,
        capabilities: ['verify_claim', 'validate_incident', 'verification_report']
      });
    });

    // Get all verifications
    app.get('/api/verifications', (_, res) => {
      const verifications = verificationEngine.getAllVerifications();
      res.json({
        success: true,
        verifications
      });
    });

    // Get specific verification
    app.get('/api/verification/:claimId', (req, res) => {
      const verification = verificationEngine.getVerificationResult(req.params.claimId);

      if (!verification) {
        return res.status(404).json({
          success: false,
          error: 'Verification not found'
        });
      }

      res.json({
        success: true,
        verification
      });
    });

    // Get statistics
    app.get('/api/stats', (_, res) => {
      const stats = verificationEngine.getStats();

      res.json({
        success: true,
        stats
      });
    });

    // Manual verification endpoint (for testing)
    app.post('/api/verify', async (req, res) => {
      try {
        const claim = req.body;

        if (!claim.claimId || !claim.mmsi) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: claimId, mmsi'
          });
        }

        const verificationResult = await verificationEngine.verifyClaim(claim, claim.riskData);

        res.json({
          success: true,
          verificationResult
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    // Start HTTP server
    app.listen(CONFIG.port, () => {
      console.log(`[Verifier] 🚀 REST API listening on port ${CONFIG.port}`);
      console.log(`[Verifier] 📡 Ready for P2P claim verification\n`);
      console.log(`[Verifier] Identity Key: ${wallet.getIdentityKey()}`);
      console.log(`[Verifier] API Endpoints:`);
      console.log(`  GET  http://localhost:${CONFIG.port}/health`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/info`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/verifications`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/verification/:claimId`);
      console.log(`  POST http://localhost:${CONFIG.port}/api/verify`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/stats\n`);
    });

    // Status reporting every 60 seconds
    setInterval(() => {
      const stats = verificationEngine.getStats();
      console.log(
        `[Verifier] Status: ${stats.totalVerifications} verifications, ${stats.approved} approved, ${stats.rejected} rejected`
      );
    }, 60_000);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n[Verifier] Shutting down...');
      if (messageBox) {
        await messageBox.disconnect();
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('[Verifier] FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run
main();
