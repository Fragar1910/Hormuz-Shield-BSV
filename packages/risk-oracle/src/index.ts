#!/usr/bin/env node
/**
 * Risk Oracle - Main Entry Point
 * Ingests AIS data, calculates risk scores, and sells data via Direct BSV Payments
 *
 * Architecture: REST API + Direct BSV Payments (BRC-29)
 * - No MessageBox (simplified for MVP)
 * - HTTP REST endpoints for data requests
 * - Direct P2PKH transactions with BRC-29 derivation
 * - Designed for 1.5M+ transactions/24h
 */

import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AgentWallet } from './wallet.js';
import { AISClient } from './ais-client.js';
import { RiskEngine } from './risk-engine.js';
import { DirectPaymentManager } from './payments.js';
import { MessageBoxManager, AgentMessage } from '@hormuz/shared';

// Load environment variables from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../..', '.env') });

// Validate environment variables
const REQUIRED_ENV = ['ORACLE_PRIVATE_KEY', 'AIS_API_KEY'];
for (const envVar of REQUIRED_ENV) {
  if (!process.env[envVar]) {
    console.error(`[RiskOracle] ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const CONFIG = {
  privateKeyWif: process.env.ORACLE_PRIVATE_KEY!,
  aisApiKey: process.env.AIS_API_KEY!,
  network: (process.env.BSV_NETWORK || 'test') as 'main' | 'test',
  port: parseInt(process.env.ORACLE_PORT || '3001'),
};

console.log('═══════════════════════════════════════════════════');
console.log('  HORMUZ SHIELD - RISK ORACLE AGENT');
console.log('  Direct BSV Payments (BRC-29)');
console.log('═══════════════════════════════════════════════════');
console.log(`Network: ${CONFIG.network}`);
console.log(`API Port: ${CONFIG.port}`);
console.log('═══════════════════════════════════════════════════\n');

async function main() {
  try {
    // Initialize wallet
    console.log('[RiskOracle] Initializing wallet...');
    const wallet = new AgentWallet({
      privateKeyWif: CONFIG.privateKeyWif,
      network: CONFIG.network,
    });
    console.log(`[RiskOracle] Wallet address: ${wallet.getAddress()}`);
    console.log(`[RiskOracle] Identity key: ${wallet.getIdentityKey().substring(0, 32)}...\n`);

    // Initialize Direct Payment Manager (BRC-29)
    console.log('[RiskOracle] Initializing Direct Payment Manager (BRC-29)...');
    const paymentManager = new DirectPaymentManager(wallet.getPrivateKey());
    console.log('[RiskOracle] Direct payments ready\n');

    // Initialize MessageBox Manager (BRC-100) - Optional
    console.log('[RiskOracle] Initializing MessageBox (BRC-100) for P2P...');
    let messageBox: MessageBoxManager | null = null;
    try {
      messageBox = new MessageBoxManager({
        walletClient: wallet.getClient(),
        serviceType: 'risk-oracle',
        messageBoxHost: process.env.MESSAGEBOX_BASE_URL || 'https://messagebox.babbage.systems',
        network: CONFIG.network === 'main' ? 'mainnet' : 'testnet',
      });
      await messageBox.init();
      console.log('[RiskOracle] ✅ MessageBox P2P ready');
      console.log(`[RiskOracle] BRC-100 Identity: ${messageBox.getIdentityKey().substring(0, 32)}...\n`);
    } catch (error: any) {
      console.warn('[RiskOracle] ⚠️  MessageBox unavailable:', error.message);
      console.warn('[RiskOracle] Continuing with Direct Payments only (BRC-29)');
      console.warn('[RiskOracle] REST API and Direct Payments will still work\n');
      messageBox = null;
    }

    // Initialize risk engine
    console.log('[RiskOracle] Initializing risk engine...');
    const riskEngine = new RiskEngine(wallet);
    console.log('[RiskOracle] Risk engine ready\n');

    // Register payment handlers for different request types
    console.log('[RiskOracle] Registering payment handlers...');

    // Handler for risk_score requests
    paymentManager.registerPaymentHandler('risk_score', async (payment, metadata) => {
      const mmsi = metadata.mmsi;

      if (!mmsi) {
        throw new Error('MMSI required for risk_score request');
      }

      const riskScore = riskEngine.getRiskScore(mmsi);
      if (!riskScore) {
        return { error: 'Risk score not found', mmsi };
      }

      return {
        success: true,
        data: riskScore,
      };
    });

    // Handler for zone_status requests
    paymentManager.registerPaymentHandler('zone_status', async (payment, metadata) => {
      const zoneId = metadata.zoneId;

      if (!zoneId) {
        throw new Error('zoneId required for zone_status request');
      }

      const zoneStatus = riskEngine.getZoneStatus(zoneId);
      return {
        success: true,
        data: zoneStatus,
      };
    });

    // Handler for risk_feed requests (all risk scores)
    paymentManager.registerPaymentHandler('risk_feed', async (payment, metadata) => {
      const allScores = riskEngine.getAllRiskScores();
      return {
        success: true,
        count: allScores.length,
        data: allScores,
      };
    });

    console.log('[RiskOracle] Payment handlers registered\n');

    // =========================================================================
    // BRC-100 MessageBox P2P Handlers (only if available)
    // =========================================================================

    if (messageBox) {
      console.log('[RiskOracle] Setting up MessageBox P2P listeners...');

      // Listen for risk data requests via MessageBox
      await messageBox.listenForLiveMessages('risk_requests', async (message: AgentMessage) => {
        console.log(`[MessageBox] Received ${message.type} from ${message.from.substring(0, 20)}...`);

        try {
          let responsePayload: any;

          switch (message.type) {
            case 'risk_query': {
              const { mmsi } = message.payload;
              const riskScore = riskEngine.getRiskScore(mmsi);
              responsePayload = riskScore || { error: 'Risk score not found', mmsi };
              break;
            }

            default:
              responsePayload = { error: 'Unknown message type', type: message.type };
          }

          // Send response back via MessageBox
          await messageBox.sendLiveMessage(message.from, 'risk_responses', {
            from: messageBox.getIdentityKey(),
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

      console.log('[RiskOracle] MessageBox P2P listeners active\n');
    } else {
      console.log('[RiskOracle] MessageBox P2P disabled - REST API and Direct Payments available\n');
    }

    // Initialize AIS client
    console.log('[RiskOracle] Connecting to AIS Stream...');
    const aisClient = new AISClient(CONFIG.aisApiKey);

    // Register position handler
    aisClient.onPosition((position) => {
      // Calculate risk for each new position
      const riskScore = riskEngine.calculateRisk(position);

      // Log high-risk vessels
      if (riskScore.aggregateRisk > 0.7) {
        console.log(
          `[RiskOracle] ⚠️  HIGH RISK: MMSI ${position.mmsi} in ${riskScore.zoneId} - Risk: ${(riskScore.aggregateRisk * 100).toFixed(1)}%`
        );
      }
    });

    aisClient.connect();
    console.log('[RiskOracle] AIS Stream connected\n');

    // =========================================================================
    // REST API Server
    // =========================================================================

    const app = express();
    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'risk-oracle',
        identityKey: wallet.getIdentityKey(),
        address: wallet.getAddress(),
      });
    });

    // Get oracle info
    app.get('/api/info', (req, res) => {
      res.json({
        identityKey: wallet.getIdentityKey(),
        address: wallet.getAddress(),
        network: CONFIG.network,
        supportedRequests: ['risk_score', 'zone_status', 'risk_feed'],
        pricing: {
          risk_score: 1, // 1 satoshi
          zone_status: 1,
          risk_feed: 5,
        },
      });
    });

    // Request payment details (step 1 of payment flow)
    app.post('/api/request-payment', (req, res) => {
      try {
        const { requestType, metadata } = req.body;

        // Determine price based on request type
        const pricing: Record<string, number> = {
          risk_score: 1,
          zone_status: 1,
          risk_feed: 5,
        };

        const satoshis = pricing[requestType] || 1;

        // Create payment request
        const paymentRequest = paymentManager.createPaymentRequest(
          satoshis,
          requestType,
          metadata
        );

        res.json({
          success: true,
          paymentRequest,
          requestType,
          metadata,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message,
        });
      }
    });

    // Receive payment and process request (step 2 of payment flow)
    app.post('/api/receive-payment', async (req, res) => {
      try {
        const payment = req.body;

        // Process payment and execute handler
        const response = await paymentManager.processPayment(payment);

        // Internalize payment into wallet
        await wallet.receiveDirectPayment(payment);

        res.json({
          success: true,
          response,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message,
        });
      }
    });

    // Get current statistics
    app.get('/api/stats', (req, res) => {
      const engineStats = riskEngine.getStats();
      const paymentStats = paymentManager.getStats();

      res.json({
        success: true,
        stats: {
          totalVessels: engineStats.totalVessels,
          bufferedEvents: engineStats.bufferedEvents,
          totalHandlers: paymentStats.totalHandlers,
          handlers: paymentStats.handlers,
        },
      });
    });

    // Start HTTP server
    app.listen(CONFIG.port, () => {
      console.log(`[RiskOracle] 🚀 REST API listening on port ${CONFIG.port}`);
      console.log(`[RiskOracle] 📡 Ready to receive AIS data and payment requests\n`);
      console.log(`[RiskOracle] Identity Key: ${wallet.getIdentityKey()}`);
      console.log(`[RiskOracle] Send payments to this identity to request risk data\n`);
      console.log(`[RiskOracle] API Endpoints:`);
      console.log(`  GET  http://localhost:${CONFIG.port}/health`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/info`);
      console.log(`  POST http://localhost:${CONFIG.port}/api/request-payment`);
      console.log(`  POST http://localhost:${CONFIG.port}/api/receive-payment`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/stats\n`);
    });

    // Status reporting every 60 seconds
    setInterval(() => {
      const stats = riskEngine.getStats();
      console.log(
        `[RiskOracle] Status: ${stats.totalVessels} vessels tracked, ${stats.bufferedEvents} events buffered`
      );
    }, 60_000);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n[RiskOracle] Shutting down...');
      aisClient.disconnect();
      riskEngine.stop();
      if (messageBox) {
        await messageBox.disconnect();
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('[RiskOracle] FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run
main();
