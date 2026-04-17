#!/usr/bin/env node
/**
 * Shipowner - Main Entry Point
 * Manages fleet, requests insurance coverage, and files claims via BRC-100
 *
 * Architecture: BRC-100 MessageBox P2P + BRC-29 Direct Payments
 */

import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AgentWallet } from './wallet.js';
import { MessageBoxManager, AgentMessage, WebSocketBroadcaster } from '@hormuz/shared';
import { FleetSimulator } from './fleet-simulator.js';
import { CoverageManager } from './coverage-manager.js';
import { ClaimFiler } from './claim-filer.js';

// Load environment variables from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../..', '.env') });

// Validate environment variables
const REQUIRED_ENV = ['SHIPOWNER_PRIVATE_KEY'];
for (const envVar of REQUIRED_ENV) {
  if (!process.env[envVar]) {
    console.error(`[Shipowner] ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const CONFIG = {
  privateKeyWif: process.env.SHIPOWNER_PRIVATE_KEY!,
  network: (process.env.BSV_NETWORK || 'test') as 'main' | 'test',
  port: parseInt(process.env.SHIPOWNER_PORT || '3003'),
  riskOracleIdentity: process.env.RISK_ORACLE_IDENTITY || '',
  insurerIdentity: process.env.INSURER_IDENTITY || '',
  fleetSize: parseInt(process.env.FLEET_SIZE || '50'),
  positionUpdateInterval: parseInt(process.env.POSITION_UPDATE_INTERVAL || '20000'),
};

console.log('═══════════════════════════════════════════════════');
console.log('  HORMUZ SHIELD - SHIPOWNER AGENT');
console.log('  BRC-100 P2P + BRC-29 Direct Payments');
console.log('═══════════════════════════════════════════════════');
console.log(`Network: ${CONFIG.network}`);
console.log(`API Port: ${CONFIG.port}`);
console.log('═══════════════════════════════════════════════════\n');

async function main() {
  try {
    // Initialize wallet
    console.log('[Shipowner] Initializing wallet...');
    const wallet = new AgentWallet({
      privateKeyWif: CONFIG.privateKeyWif,
      network: CONFIG.network,
    });
    console.log(`[Shipowner] Wallet address: ${wallet.getAddress()}`);
    console.log(`[Shipowner] Identity key: ${wallet.getIdentityKey().substring(0, 32)}...\n`);

    // Initialize MessageBox Manager (BRC-100) - Optional
    console.log('[Shipowner] Initializing MessageBox (BRC-100) for P2P...');
    let messageBox: MessageBoxManager | null = null;
    try {
      messageBox = new MessageBoxManager({
        walletClient: wallet.getClient(),
        serviceType: 'shipowner',
        messageBoxHost: process.env.MESSAGEBOX_BASE_URL || 'https://messagebox.babbage.systems',
        network: CONFIG.network === 'main' ? 'mainnet' : 'testnet',
      });
      await messageBox.init();
      console.log('[Shipowner] ✅ MessageBox P2P ready');
      console.log(`[Shipowner] BRC-100 Identity: ${messageBox.getIdentityKey().substring(0, 32)}...\n`);
    } catch (error: any) {
      console.warn('[Shipowner] ⚠️  MessageBox unavailable:', error.message);
      console.warn('[Shipowner] Continuing with Direct Payments only (BRC-29)');
      console.warn('[Shipowner] System will operate without P2P messaging\n');
      messageBox = null;
    }

    // Initialize fleet simulator
    console.log(`[Shipowner] Initializing fleet with ${CONFIG.fleetSize} vessels...`);
    const fleetSimulator = new FleetSimulator(CONFIG.fleetSize);
    fleetSimulator.initializeFleet();
    console.log(`[Shipowner] Fleet initialized with ${CONFIG.fleetSize} vessels\n`);

    // Initialize coverage manager (only if MessageBox available)
    let coverageManager: CoverageManager | null = null;
    let claimFiler: ClaimFiler | null = null;

    if (messageBox) {
      coverageManager = new CoverageManager(messageBox);
      claimFiler = new ClaimFiler(messageBox);
      console.log('[Shipowner] Coverage manager and claim filer initialized with P2P\n');
    } else {
      console.warn('[Shipowner] ⚠️  Coverage manager disabled (requires MessageBox)');
      console.warn('[Shipowner] Fleet tracking and WebSocket broadcasting will still work\n');
    }

    // Initialize WebSocket broadcaster for real-time UI updates
    console.log('[Shipowner] Initializing WebSocket broadcaster for UI...');
    const wsBroadcaster = new WebSocketBroadcaster(CONFIG.port + 100); // e.g., 3103 if shipowner is on 3003
    console.log(`[Shipowner] WebSocket server ready on port ${CONFIG.port + 100}\n`);

    // Connect transaction logger to broadcaster for real-time transaction updates
    wallet.getTransactionLogger().onTransaction((txLog) => {
      // Convert TransactionLog to TxEvent format for UI
      wsBroadcaster.broadcastTransaction({
        id: `tx-${Date.now()}`,
        type: txLog.type,
        amount: txLog.amount_sats,
        from: txLog.agent_from,
        to: txLog.agent_to,
        timestamp: new Date(txLog.timestamp).getTime(),
        txid: txLog.txid,
      });
    });

    // =========================================================================
    // BRC-100 MessageBox P2P Handlers (only if available)
    // =========================================================================

    if (messageBox && coverageManager && claimFiler) {
      console.log('[Shipowner] Setting up MessageBox P2P listeners...');

      // Listen for insurance responses
      await messageBox.listenForLiveMessages('insurance_responses', async (message: AgentMessage) => {
        console.log(`[MessageBox] Received ${message.type} from ${message.from.substring(0, 20)}...`);

        try {
          switch (message.type) {
            case 'policy_response':
              coverageManager!.handlePolicyResponse(message);
              break;

            case 'claim_response':
              claimFiler!.handleClaimResponse(message);
              break;

            default:
              console.log(`[MessageBox] Unknown message type: ${message.type}`);
          }
        } catch (error) {
          console.error('[MessageBox] Error processing message:', error);
        }
      });

      console.log('[Shipowner] MessageBox P2P listeners active\n');
    } else {
      console.log('[Shipowner] MessageBox P2P disabled - Fleet tracking and UI updates available\n');
    }

    // =========================================================================
    // Automated Coverage Management Loop
    // =========================================================================

    console.log(`[Shipowner] Starting automated coverage management (update interval: ${CONFIG.positionUpdateInterval}ms)...`);

    // Update positions and request coverage
    const managementInterval = setInterval(async () => {
      try {
        // Update vessel positions
        fleetSimulator.updatePositions();

        // Get updated vessels
        const vessels = fleetSimulator.getVessels();

        // Broadcast vessel updates to UI
        const vesselsForUI = vessels.map(v => {
          // Calculate basic risk based on zone
          let risk = 0.3; // Default low risk
          if (v.currentPosition.lat >= 25.0 && v.currentPosition.lat <= 27.0 &&
              v.currentPosition.lon >= 56.0 && v.currentPosition.lon <= 58.0) {
            risk = 0.75; // High risk - Hormuz
          } else if (v.currentPosition.lat >= 12.0 && v.currentPosition.lat <= 14.0 &&
                     v.currentPosition.lon >= 43.0 && v.currentPosition.lon <= 45.0) {
            risk = 0.65; // Medium-high risk - Bab el-Mandeb
          }

          return {
            mmsi: v.mmsi,
            lat: v.currentPosition.lat,
            lon: v.currentPosition.lon,
            risk,
            type: v.type,
          };
        });
        wsBroadcaster.broadcastVessels(vesselsForUI);

        // Check each vessel for coverage needs (only if MessageBox available)
        if (coverageManager) {
          for (const vessel of vessels) {
            // Simple zone detection based on position
            let zoneId = 'SAFE';
            if (vessel.currentPosition.lat >= 25.0 && vessel.currentPosition.lat <= 27.0 &&
                vessel.currentPosition.lon >= 56.0 && vessel.currentPosition.lon <= 58.0) {
              zoneId = 'HORMUZ';
            } else if (vessel.currentPosition.lat >= 12.0 && vessel.currentPosition.lat <= 14.0 &&
                       vessel.currentPosition.lon >= 43.0 && vessel.currentPosition.lon <= 45.0) {
              zoneId = 'BAB_MANDEB';
            }

            // Request coverage if in risk zone and no active policy
            if (zoneId !== 'SAFE' && !coverageManager.hasActiveCoverage(vessel.mmsi, zoneId)) {
              console.log(`[Shipowner] Vessel ${vessel.mmsi} entering ${zoneId} - requesting coverage`);

              // Mock risk score for demo
              const mockRiskScore = {
                vesselMmsi: vessel.mmsi,
                zoneId,
                aggregateRisk: 0.5,
                baseRisk: 0.4,
                proximityRisk: 0.05,
                speedAnomaly: 0.03,
                courseAnomaly: 0.02,
                confidence: 0.9,
                premiumBasisBps: 100,
                timestamp: Date.now()
              };

              await coverageManager.requestCoverage(
                vessel,
                zoneId,
                60, // 60 seconds coverage
                CONFIG.insurerIdentity,
                CONFIG.riskOracleIdentity,
                mockRiskScore
              );
            }
          }

          // Cleanup expired policies
          coverageManager.cleanupExpiredPolicies();
        }

      } catch (error) {
        console.error('[Shipowner] Error in management loop:', error);
      }
    }, CONFIG.positionUpdateInterval);

    console.log('[Shipowner] Automated coverage management active\n');

    // =========================================================================
    // REST API Server
    // =========================================================================

    const app = express();
    app.use(express.json());

    // Health check
    app.get('/health', (_, res) => {
      res.json({
        status: 'ok',
        service: 'shipowner',
        identityKey: wallet.getIdentityKey(),
        address: wallet.getAddress(),
      });
    });

    // Get fleet status
    app.get('/api/fleet', (_, res) => {
      const vessels = fleetSimulator.getVessels();
      res.json({
        success: true,
        vessels: vessels.map(v => ({
          mmsi: v.mmsi,
          name: v.name,
          type: v.type,
          position: v.currentPosition,
          hullValueUsd: v.hullValueUsd
        }))
      });
    });

    // Get coverage status
    app.get('/api/coverage', (_, res) => {
      if (!coverageManager) {
        return res.json({
          success: false,
          error: 'Coverage manager unavailable (MessageBox not connected)',
          activePolicies: [],
          stats: {}
        });
      }

      const policies = coverageManager.getActivePolicies();
      const stats = coverageManager.getStats();

      res.json({
        success: true,
        activePolicies: policies,
        stats
      });
    });

    // Get claims status
    app.get('/api/claims', (_, res) => {
      if (!claimFiler) {
        return res.json({
          success: false,
          error: 'Claim filer unavailable (MessageBox not connected)',
          claims: [],
          stats: {}
        });
      }

      const claims = claimFiler.getAllClaims();
      const stats = claimFiler.getStats();

      res.json({
        success: true,
        claims,
        stats
      });
    });

    // Manually file a claim
    app.post('/api/file-claim', async (req, res) => {
      try {
        if (!coverageManager || !claimFiler) {
          return res.status(503).json({
            success: false,
            error: 'Coverage and claims unavailable (MessageBox not connected)'
          });
        }

        const { mmsi, claimType, claimAmountSats, eventDescription } = req.body;

        if (!mmsi || !claimType || !claimAmountSats) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const policy = coverageManager.getPolicyForVessel(mmsi);
        if (!policy) {
          return res.status(404).json({ error: 'No active policy for vessel' });
        }

        const claimId = await claimFiler.fileClaim(
          policy,
          claimType,
          claimAmountSats,
          eventDescription || 'Manual claim filing',
          policy.insurerIdentity
        );

        res.json({
          success: true,
          claimId
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    // Get statistics
    app.get('/api/stats', (_, res) => {
      const fleetStats = {
        totalVessels: fleetSimulator.getVessels().length,
        vessels: fleetSimulator.getVessels().map(v => v.mmsi)
      };
      const coverageStats = coverageManager ? coverageManager.getStats() : { unavailable: true };
      const claimStats = claimFiler ? claimFiler.getStats() : { unavailable: true };

      res.json({
        success: true,
        stats: {
          fleet: fleetStats,
          coverage: coverageStats,
          claims: claimStats,
          messageBoxAvailable: messageBox !== null
        }
      });
    });

    // Start HTTP server
    app.listen(CONFIG.port, () => {
      console.log(`[Shipowner] 🚀 REST API listening on port ${CONFIG.port}`);
      console.log(`[Shipowner] 📡 Ready for P2P messaging and fleet management\n`);
      console.log(`[Shipowner] Identity Key: ${wallet.getIdentityKey()}`);
      console.log(`[Shipowner] API Endpoints:`);
      console.log(`  GET  http://localhost:${CONFIG.port}/health`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/fleet`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/coverage`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/claims`);
      console.log(`  POST http://localhost:${CONFIG.port}/api/file-claim`);
      console.log(`  GET  http://localhost:${CONFIG.port}/api/stats\n`);
    });

    // Status reporting every 60 seconds
    setInterval(() => {
      if (coverageManager && claimFiler) {
        const coverageStats = coverageManager.getStats();
        const claimStats = claimFiler.getStats();
        console.log(
          `[Shipowner] Status: ${fleetSimulator.getVessels().length} vessels, ${coverageStats.activePolicies} active policies, ${claimStats.totalClaims} claims`
        );
      } else {
        console.log(
          `[Shipowner] Status: ${fleetSimulator.getVessels().length} vessels tracked, P2P features disabled`
        );
      }
    }, 60_000);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n[Shipowner] Shutting down...');
      clearInterval(managementInterval);
      if (messageBox) {
        await messageBox.disconnect();
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('[Shipowner] FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run
main();
