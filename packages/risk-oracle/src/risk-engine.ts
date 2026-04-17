/**
 * Risk Oracle - Risk Calculation Engine
 * Calculates risk scores for vessels in real-time
 */

import {
  VesselPosition,
  RiskScore,
  autoCalculateRisk,
  BatchRecorder,
} from '@hormuz/shared';
import type { AgentWallet } from './wallet';

export class RiskEngine {
  private riskScores: Map<string, RiskScore> = new Map();
  private batchRecorder: BatchRecorder;
  private wallet: AgentWallet;

  constructor(wallet: AgentWallet) {
    this.wallet = wallet;

    // Initialize batch recorder for on-chain recording
    this.batchRecorder = new BatchRecorder(
      'RiskOracle',
      async (merkleRoot: string, count: number) => {
        return await this.flushBatchOnChain(merkleRoot, count);
      },
      60_000 // Flush every 60 seconds
    );

    this.batchRecorder.start();
  }

  /**
   * Calculate risk score for a vessel position
   */
  calculateRisk(position: VesselPosition): RiskScore {
    // Use shared risk calculator
    const riskScore = autoCalculateRisk(position);

    // Store in memory
    this.riskScores.set(position.mmsi, riskScore);

    // Add to batch for on-chain recording
    this.batchRecorder.add('risk_score', {
      mmsi: position.mmsi,
      zone: riskScore.zoneId,
      score: riskScore.aggregateRisk,
      timestamp: riskScore.timestamp,
    });

    return riskScore;
  }

  /**
   * Get risk score for MMSI
   */
  getRiskScore(mmsi: string): RiskScore | undefined {
    return this.riskScores.get(mmsi);
  }

  /**
   * Get all risk scores
   */
  getAllRiskScores(): RiskScore[] {
    return Array.from(this.riskScores.values());
  }

  /**
   * Get risk scores for a specific zone
   */
  getRiskScoresByZone(zoneId: string): RiskScore[] {
    return this.getAllRiskScores().filter(score => score.zoneId === zoneId);
  }

  /**
   * Get zone status (aggregate stats for a zone)
   */
  getZoneStatus(zoneId: string): {
    zoneId: string;
    vesselCount: number;
    averageRisk: number;
    maxRisk: number;
    minRisk: number;
    timestamp: number;
  } {
    const scores = this.getRiskScoresByZone(zoneId);

    if (scores.length === 0) {
      return {
        zoneId,
        vesselCount: 0,
        averageRisk: 0,
        maxRisk: 0,
        minRisk: 0,
        timestamp: Date.now(),
      };
    }

    const risks = scores.map(s => s.aggregateRisk);
    const sum = risks.reduce((a, b) => a + b, 0);

    return {
      zoneId,
      vesselCount: scores.length,
      averageRisk: sum / scores.length,
      maxRisk: Math.max(...risks),
      minRisk: Math.min(...risks),
      timestamp: Date.now(),
    };
  }

  /**
   * Flush batch to blockchain
   */
  private async flushBatchOnChain(merkleRoot: string, count: number): Promise<string> {
    try {
      // TODO: Implement on-chain recording via WalletClient
      // For MVP, we'll return a placeholder txid
      const placeholderTxid = `batch_${Date.now()}_${merkleRoot.substring(0, 16)}`;

      console.log(`[RiskEngine] Batch recorded (placeholder): ${count} events, root: ${merkleRoot.substring(0, 16)}...`);

      return placeholderTxid;
    } catch (error) {
      console.error('[RiskEngine] Error flushing batch on-chain:', error);
      throw error;
    }
  }

  /**
   * Stop the risk engine
   */
  stop(): void {
    this.batchRecorder.stop();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalVessels: number;
    totalScoresCalculated: number;
    bufferedEvents: number;
  } {
    return {
      totalVessels: this.riskScores.size,
      totalScoresCalculated: this.riskScores.size,
      bufferedEvents: this.batchRecorder.getBufferSize(),
    };
  }
}
