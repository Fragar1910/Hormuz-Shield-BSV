#!/usr/bin/env node
/**
 * Insurer Pool - Main Entry Point
 * Underwrites marine insurance policies based on risk data from Risk Oracle
 *
 * Architecture: Consumes Risk Oracle data via Direct BSV Payments
 * Components:
 * - PricingEngine: Dynamic premium calculation
 * - PolicyManager: Policy issuance and tracking
 * - PoolTreasury: Balance and exposure management
 * - ClaimsHandler: Claim evaluation and payouts
 */

import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AgentWallet } from './wallet.js';
import { PaymentClient } from './payments.js';
import { PricingEngine } from './pricing-engine.js';
import { PolicyManager } from './policy-manager.js';
import { PoolTreasury } from './pool-treasury.js';
import { ClaimsHandler } from './claims-handler.js';
import { MessageBoxManager, AgentMessage } from '@hormuz/shared';

// Load environment variables from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../..', '.env') });

// Validate environment variables
const REQUIRED_ENV = ['INSURER_PRIVATE_KEY'];
for (const envVar of REQUIRED_ENV) {
  if (!process.env[envVar]) {
    console.error(`[Insurer] ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const CONFIG = {
  privateKeyWif: process.env.INSURER_PRIVATE_KEY!,
  network: (process.env.BSV_NETWORK || 'test') as 'main' | 'test',
  port: parseInt(process.env.INSURER_PORT || '3002'),
  riskOracleUrl: process.env.RISK_ORACLE_URL || 'http://localhost:3001',
  poolCapacitySats: parseInt(process.env.POOL_CAPACITY_SATS || '100000000'), // 1 BSV
};

console.log('═══════════════════════════════════════════════════');
console.log('  HORMUZ SHIELD - INSURER POOL AGENT');
console.log('  Direct BSV Payments (BRC-29)');
console.log('═══════════════════════════════════════════════════');
console.log(`Network: ${CONFIG.network}`);
console.log(`API Port: ${CONFIG.port}`);
console.log(`Risk Oracle: ${CONFIG.riskOracleUrl}`);
console.log(`Pool Capacity: ${CONFIG.poolCapacitySats} sats`);
console.log('═══════════════════════════════════════════════════\n');

async function main() {
  try {
    // Initialize wallet
    console.log('[Insurer] Initializing wallet...');
    const wallet = new AgentWallet({
      privateKeyWif: CONFIG.privateKeyWif,
      network: CONFIG.network,
    });
    console.log(`[Insurer] Wallet address: ${wallet.getAddress()}`);
    console.log(`[Insurer] Identity key: ${wallet.getIdentityKey().substring(0, 32)}...\n`);

    // Initialize core components
    console.log('[Insurer] Initializing core components...');
    const pricingEngine = new PricingEngine();
    const policyManager = new PolicyManager(pricingEngine);
    const treasury = new PoolTreasury({
      poolCapacitySats: CONFIG.poolCapacitySats,
      maxVesselExposureRatio: 0.30, // Max 30% of pool per vessel
      minPoolReserveRatio: 0.20, // Keep 20% in reserve
      rebalanceThresholdRatio: 0.25,
    });
    const claimsHandler = new ClaimsHandler(policyManager, treasury);
    console.log('[Insurer] Core components initialized\n');

    // Initialize Payment Client to consume Risk Oracle data (BRC-29)
    console.log('[Insurer] Connecting to Risk Oracle (BRC-29)...');
    const paymentClient = new PaymentClient(CONFIG.riskOracleUrl, wallet);
    console.log('[Insurer] Risk Oracle client ready\n');

    // Initialize MessageBox Manager (BRC-100) - Optional
    console.log('[Insurer] Initializing MessageBox (BRC-100) for P2P...');
    let messageBox: MessageBoxManager | null = null;
    try {
      messageBox = new MessageBoxManager({
        walletClient: wallet.getClient(),
        serviceType: 'insurer-pool',
        messageBoxHost: process.env.MESSAGEBOX_BASE_URL || 'https://messagebox.babbage.systems',
        network: CONFIG.network === 'main' ? 'mainnet' : 'testnet',
      });
      await messageBox.init();
      console.log('[Insurer] ✅ MessageBox P2P ready');
      console.log(`[Insurer] BRC-100 Identity: ${messageBox.getIdentityKey().substring(0, 32)}...\n`);
    } catch (error: any) {
      console.warn('[Insurer] ⚠️  MessageBox unavailable:', error.message);
      console.warn('[Insurer] Continuing with REST API only');
      console.warn('[Insurer] Policy issuance via REST will still work\n');
      messageBox = null;
    }

    // =========================================================================
    // BRC-100 MessageBox P2P Handlers (only if available)
    // =========================================================================

    if (messageBox) {
      console.log('[Insurer] Setting up MessageBox P2P listeners...');

      // Listen for policy requests via MessageBox
      await messageBox.listenForLiveMessages('insurance_requests', async (message: AgentMessage) => {
        console.log(`[MessageBox] Received ${message.type} from ${message.from.substring(0, 20)}...`);

        try {
          let responsePayload: any;

          switch (message.type) {
            case 'policy_request': {
              const { mmsi, duration, hullValueUsd } = message.payload;

              // Get risk score from Risk Oracle via P2P
              const riskRequestMsg: AgentMessage = {
                from: messageBox!.getIdentityKey(),
                to: message.payload.oracleIdentity || '',
                type: 'risk_query',
                payload: { mmsi },
                timestamp: Date.now(),
              };

              // Send to oracle and wait for response
              await messageBox!.sendLiveMessage(
                riskRequestMsg.to,
                'risk_requests',
                riskRequestMsg
              );

              // In a real implementation, we'd wait for the response
              // For MVP, we'll use a placeholder
              const poolUtilization = treasury.getUtilizationRatio();
              const quote = pricingEngine.getQuote(
                hullValueUsd,
                duration,
                message.payload.riskScore, // Provided by client for MVP
                poolUtilization
              );

              responsePayload = {
                success: true,
                quote,
              };
              break;
            }

            default:
              responsePayload = { error: 'Unknown message type', type: message.type };
          }

          // Send response back via MessageBox
          await messageBox!.sendLiveMessage(message.from, 'insurance_responses', {
            from: messageBox!.getIdentityKey(),
            to: message.from,
            type: 'policy_response',
            payload: responsePayload,
            timestamp: Date.now(),
          });

          console.log(`[MessageBox] Sent response to ${message.from.substring(0, 20)}...`);
        } catch (error) {
          console.error('[MessageBox] Error processing message:', error);
        }
      });

      console.log('[Insurer] MessageBox P2P listeners active\n');
    } else {
      console.log('[Insurer] MessageBox P2P disabled - REST API available for policy operations\n');
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
        service: 'insurer-pool',
        identityKey: wallet.getIdentityKey(),
        address: wallet.getAddress(),
      });
    });

    // Get insurer info
    app.get('/api/info', (_, res) => {
      const treasuryStats = treasury.getStats();
      const policyStats = policyManager.getStats();

      res.json({
        identityKey: wallet.getIdentityKey(),
        address: wallet.getAddress(),
        network: CONFIG.network,
        treasury: treasuryStats,
        policies: policyStats,
      });
    });

    // Request quote for a vessel
    app.post('/api/quote', async (req, res) => {
      try {
        const { mmsi, duration, hullValueUsd } = req.body;

        if (!mmsi || !duration) {
          return res.status(400).json({ error: 'Missing required fields: mmsi, duration' });
        }

        console.log(`[Insurer] Quote requested for vessel ${mmsi}`);

        // 1. Get risk score from oracle (pays for data)
        const riskData = await paymentClient.requestRiskScore(mmsi);

        if (!riskData.success) {
          return res.status(500).json({ error: 'Failed to get risk data from oracle', details: riskData.error });
        }

        // 2. Check if pool can accept exposure
        const hull = hullValueUsd || 100_000; // Default $100k hull value
        const durationSecs = duration || 60; // Default 60s
        const poolUtilization = treasury.getUtilizationRatio();

        const pricing = pricingEngine.calculatePremium({
          hullValueUsd: hull,
          durationSeconds: durationSecs,
          riskScore: riskData.data,
          poolUtilization,
        });

        const exposureCheck = treasury.canAcceptExposure(mmsi, pricing.coverageSats);

        if (!exposureCheck.allowed) {
          return res.status(400).json({
            error: 'Cannot accept exposure',
            reason: exposureCheck.reason,
            currentVesselExposure: exposureCheck.currentVesselExposure,
            maxVesselExposure: exposureCheck.maxVesselExposure,
          });
        }

        // 3. Return quote
        const quote = pricingEngine.getQuote(
          hull,
          durationSecs,
          riskData.data,
          poolUtilization
        );

        res.json({
          success: true,
          quote: {
            ...quote,
            mmsi,
            hullValueUsd: hull,
            durationSeconds: durationSecs,
            poolUtilization,
            pricing: {
              basePremium: pricing.basePremiumSats,
              riskMultiplier: pricing.riskMultiplier,
              utilizationFactor: pricing.poolUtilizationFactor,
              breakdown: pricing.breakdown,
            },
          },
        });
      } catch (error: any) {
        console.error('[Insurer] Quote error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    });

    // Issue a policy (after premium payment)
    app.post('/api/issue-policy', async (req, res) => {
      try {
        const { mmsi, hullValueUsd, duration, premiumTxid, zoneId } = req.body;

        if (!mmsi || !premiumTxid) {
          return res.status(400).json({ error: 'Missing required fields: mmsi, premiumTxid' });
        }

        console.log(`[Insurer] Policy issuance requested for vessel ${mmsi}`);

        // 1. Get current risk score
        const riskData = await paymentClient.requestRiskScore(mmsi);
        if (!riskData.success) {
          return res.status(500).json({ error: 'Failed to get risk data' });
        }

        const hull = hullValueUsd || 100_000;
        const durationSecs = duration || 60;
        const poolUtilization = treasury.getUtilizationRatio();

        // 2. Calculate pricing
        const pricing = pricingEngine.calculatePremium({
          hullValueUsd: hull,
          durationSeconds: durationSecs,
          riskScore: riskData.data,
          poolUtilization,
        });

        // 3. Check exposure limits
        const exposureCheck = treasury.canAcceptExposure(mmsi, pricing.coverageSats);
        if (!exposureCheck.allowed) {
          return res.status(400).json({
            error: 'Cannot accept exposure',
            reason: exposureCheck.reason,
          });
        }

        // 4. Issue policy
        const policy = policyManager.issuePolicy({
          vesselMmsi: mmsi,
          zoneId: zoneId || riskData.data.zoneId,
          hullValueUsd: hull,
          durationSeconds: durationSecs,
          riskScore: riskData.data,
          premiumTxid,
          poolUtilization,
        });

        // 5. Update treasury
        treasury.addExposure(policy);
        treasury.recordPremiumInflow(pricing.premiumSats);

        res.json({
          success: true,
          policy,
        });
      } catch (error: any) {
        console.error('[Insurer] Policy issuance error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    });

    // Get active policies
    app.get('/api/policies', (req, res) => {
      const { mmsi, zone } = req.query;

      let policies;
      if (mmsi) {
        policies = policyManager.getVesselPolicies(mmsi as string);
      } else if (zone) {
        policies = policyManager.getZonePolicies(zone as string);
      } else {
        policies = policyManager.getActivePolicies();
      }

      res.json({ success: true, policies });
    });

    // Submit a claim
    app.post('/api/claim', async (req, res) => {
      try {
        const { claimId, policyId, vesselMmsi, claimType, claimAmountSats, eventDescription } = req.body;

        if (!claimId || !policyId || !vesselMmsi || !claimType || !claimAmountSats) {
          return res.status(400).json({
            error: 'Missing required fields: claimId, policyId, vesselMmsi, claimType, claimAmountSats',
          });
        }

        console.log(`[Insurer] Claim submitted: ${claimId} for policy ${policyId}`);

        // Get current risk score for validation
        const riskData = await paymentClient.requestRiskScore(vesselMmsi);

        const evaluation = await claimsHandler.evaluateClaim(
          {
            claimId,
            policyId,
            vesselMmsi,
            claimType,
            claimAmountSats,
            timestamp: Date.now(),
            eventDescription: eventDescription || '',
          },
          riskData.success ? riskData.data : undefined
        );

        // If approved, process payout
        let payoutTxid;
        if (evaluation.status === 'approved') {
          payoutTxid = await claimsHandler.processClaimPayout(claimId);
        }

        res.json({
          success: true,
          evaluation: {
            ...evaluation,
            payoutTxid,
          },
        });
      } catch (error: any) {
        console.error('[Insurer] Claim error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    });

    // Get statistics
    app.get('/api/stats', (_, res) => {
      const treasuryStats = treasury.getStats();
      const policyStats = policyManager.getStats();
      const claimsStats = claimsHandler.getStats();

      res.json({
        success: true,
        treasury: treasuryStats,
        policies: policyStats,
        claims: claimsStats,
      });
    });

    // Start server
    app.listen(CONFIG.port, () => {
      console.log(`[Insurer] 🚀 REST API listening on port ${CONFIG.port}`);
      console.log(`[Insurer] 📡 Ready to issue policies\n`);

      console.log(`[Insurer] API Endpoints:`);
      console.log(`  GET  http://localhost:${CONFIG.port}/health`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/info`);
      console.log(`  POST http://localhost:${CONFIG.port}/api/quote`);
      console.log(`  POST http://localhost:${CONFIG.port}/api/issue-policy`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/policies`);
      console.log(`  POST http://localhost:${CONFIG.port}/api/claim`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/stats\n`);
    });

    // =========================================================================
    // Background Tasks
    // =========================================================================

    // Expire old policies every 10 seconds
    setInterval(() => {
      policyManager.expireOldPolicies();
    }, 10_000);

    // Cleanup expired policies every hour
    setInterval(() => {
      policyManager.cleanupExpiredPolicies();
    }, 3600_000);

    // Monitor pool health every minute
    setInterval(() => {
      const treasuryStats = treasury.getStats();
      const policyStats = policyManager.getStats();
      console.log(
        `[Insurer] Pool health: ${(treasuryStats.utilizationRatio * 100).toFixed(1)}% utilized, ` +
          `${policyStats.activePolicies} active policies, ` +
          `${treasuryStats.currentBalanceSats} sats balance`
      );

      if (treasuryStats.needsRebalancing) {
        console.warn(`[Insurer] ⚠️  Pool needs rebalancing (reserve: ${treasuryStats.reserveRatio * 100}%)`);
      }
    }, 60_000);

  } catch (error) {
    console.error('[Insurer] Fatal error:', error);
    process.exit(1);
  }
}

// Run main
main().catch(error => {
  console.error('[Insurer] Unhandled error:', error);
  process.exit(1);
});
