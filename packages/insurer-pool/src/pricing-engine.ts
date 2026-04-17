/**
 * Insurer Pool - Pricing Engine
 * Dynamic premium calculation based on risk scores, pool utilization, and vessel value
 *
 * Formula:
 * premium_sats = hull_value_sats × risk_score × duration_factor × pool_utilization_factor
 */

import { RiskScore } from '@hormuz/shared';

export interface PricingParameters {
  hullValueUsd: number;
  durationSeconds: number;
  riskScore: RiskScore;
  poolUtilization: number; // 0.0 to 1.0 (exposure/capacity)
  usdToSatsRate?: number; // Default: 1 USD = 10000 sats
}

export interface PricingResult {
  premiumSats: number;
  coverageSats: number;
  basePremiumSats: number;
  riskMultiplier: number;
  durationFactor: number;
  poolUtilizationFactor: number;
  breakdown: {
    baseRate: number;
    riskAdjustment: number;
    durationAdjustment: number;
    utilizationAdjustment: number;
  };
}

export class PricingEngine {
  private readonly BASE_RATE = 0.01; // 1% base rate
  private readonly MIN_PREMIUM_SATS = 10;
  private readonly MAX_PREMIUM_SATS = 1_000_000; // 0.01 BSV max
  private readonly MINUTES_PER_DAY = 1440;
  private readonly DEFAULT_USD_TO_SATS = 10_000; // 1 USD = 10k sats (placeholder)

  /**
   * Calculate premium for a micro-policy
   *
   * @param params Pricing parameters including hull value, duration, risk, and pool state
   * @returns Detailed pricing breakdown
   */
  calculatePremium(params: PricingParameters): PricingResult {
    const {
      hullValueUsd,
      durationSeconds,
      riskScore,
      poolUtilization,
      usdToSatsRate = this.DEFAULT_USD_TO_SATS,
    } = params;

    // 1. Convert hull value to satoshis
    const hullValueSats = Math.floor(hullValueUsd * usdToSatsRate);

    // 2. Calculate duration factor (for micro-policies, typically 60s)
    // duration_factor = duration_minutes / 1440 (1 day = 1440 minutes)
    const durationMinutes = durationSeconds / 60;
    const durationFactor = durationMinutes / this.MINUTES_PER_DAY;

    // 3. Calculate risk multiplier (0.0-1.0 risk → 1.0x-11.0x multiplier)
    // Higher risk = exponentially higher premium
    const riskMultiplier = 1 + (riskScore.aggregateRisk * 10);

    // 4. Calculate pool utilization factor (1.0x-2.0x)
    // When pool is highly utilized, charge more to reduce new exposure
    const poolUtilizationFactor = 1 + poolUtilization;

    // 5. Base premium calculation
    const basePremiumSats = Math.floor(
      hullValueSats * this.BASE_RATE * durationFactor
    );

    // 6. Apply all multipliers
    let premiumSats = Math.floor(
      basePremiumSats * riskMultiplier * poolUtilizationFactor
    );

    // 7. Apply min/max bounds
    premiumSats = Math.max(this.MIN_PREMIUM_SATS, premiumSats);
    premiumSats = Math.min(this.MAX_PREMIUM_SATS, premiumSats);

    // 8. Coverage is typically a multiple of hull value (for MVP, 100% coverage)
    const coverageSats = hullValueSats;

    return {
      premiumSats,
      coverageSats,
      basePremiumSats,
      riskMultiplier,
      durationFactor,
      poolUtilizationFactor,
      breakdown: {
        baseRate: this.BASE_RATE,
        riskAdjustment: (riskMultiplier - 1) * 100, // % increase
        durationAdjustment: durationFactor,
        utilizationAdjustment: (poolUtilizationFactor - 1) * 100, // % increase
      },
    };
  }

  /**
   * Calculate quote for display (without committing to pool)
   */
  getQuote(
    hullValueUsd: number,
    durationSeconds: number,
    riskScore: RiskScore,
    poolUtilization: number
  ): {
    premium: number;
    coverage: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    validUntil: number;
  } {
    const pricing = this.calculatePremium({
      hullValueUsd,
      durationSeconds,
      riskScore,
      poolUtilization,
    });

    // Classify risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (riskScore.aggregateRisk < 0.3) riskLevel = 'LOW';
    else if (riskScore.aggregateRisk < 0.6) riskLevel = 'MEDIUM';
    else if (riskScore.aggregateRisk < 0.8) riskLevel = 'HIGH';
    else riskLevel = 'CRITICAL';

    return {
      premium: pricing.premiumSats,
      coverage: pricing.coverageSats,
      riskLevel,
      validUntil: Date.now() + 60_000, // Quote valid for 60 seconds
    };
  }

  /**
   * Calculate loss ratio for a vessel
   * Used to determine if vessel should be declined
   */
  calculateLossRatio(
    totalClaimsPaid: number,
    totalPremiumsCollected: number
  ): number {
    if (totalPremiumsCollected === 0) return 0;
    return totalClaimsPaid / totalPremiumsCollected;
  }

  /**
   * Determine if a vessel should be declined based on loss history
   */
  shouldDeclineVessel(lossRatio: number, riskScore: number): boolean {
    // Decline if loss ratio > 150% and high risk
    if (lossRatio > 1.5 && riskScore > 0.7) return true;
    // Decline if loss ratio > 200% regardless of risk
    if (lossRatio > 2.0) return true;
    return false;
  }

  /**
   * Calculate pool premium income for a time period
   */
  calculatePoolIncome(
    policies: Array<{ premiumSats: number; startTime: number; durationSeconds: number }>,
    periodStart: number,
    periodEnd: number
  ): number {
    return policies
      .filter(p => {
        const policyEnd = p.startTime + p.durationSeconds * 1000;
        return p.startTime <= periodEnd && policyEnd >= periodStart;
      })
      .reduce((sum, p) => sum + p.premiumSats, 0);
  }
}
