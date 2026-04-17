/**
 * Insurer Pool - Pool Treasury
 * Manages pool balance, exposure limits, and risk concentration
 *
 * Key responsibilities:
 * - Track total pool capacity
 * - Monitor current exposure
 * - Enforce exposure limits per vessel (max 30% of pool)
 * - Track premiums and claims cash flow
 * - Pool rebalancing logic
 */

import { MicroPolicy } from '@hormuz/shared';

export interface TreasuryConfig {
  poolCapacitySats: number; // Total pool size (e.g., 100M sats = 1 BSV)
  maxVesselExposureRatio: number; // Max % of pool for single vessel (default 0.30)
  minPoolReserveRatio: number; // Min % to keep in reserve (default 0.20)
  rebalanceThresholdRatio: number; // Trigger rebalance when reserve < this (default 0.25)
}

export interface TreasuryStats {
  poolCapacitySats: number;
  currentBalanceSats: number;
  totalExposureSats: number;
  availableCapacitySats: number;
  reserveSats: number;
  utilizationRatio: number; // exposure / capacity
  reserveRatio: number; // reserve / capacity
  needsRebalancing: boolean;
  premiumIncome24h: number;
  claimsPaid24h: number;
  netIncome24h: number;
  exposureByVessel: Record<string, number>; // mmsi → total exposure
  exposureByZone: Record<string, number>; // zone → total exposure
}

export interface ExposureCheck {
  allowed: boolean;
  reason?: string;
  currentVesselExposure: number;
  maxVesselExposure: number;
  currentPoolUtilization: number;
}

export class PoolTreasury {
  private config: TreasuryConfig;
  private currentBalanceSats: number;
  private totalExposureSats: number = 0;

  // Cash flow tracking (24h rolling window)
  private premiumInflows: Array<{ timestamp: number; amount: number }> = [];
  private claimOutflows: Array<{ timestamp: number; amount: number }> = [];

  // Exposure tracking by vessel and zone
  private vesselExposure: Map<string, number> = new Map();
  private zoneExposure: Map<string, number> = new Map();

  constructor(config: TreasuryConfig) {
    this.config = config;
    this.currentBalanceSats = config.poolCapacitySats; // Start with full capacity
  }

  /**
   * Check if pool can accept new exposure for a vessel
   *
   * @param vesselMmsi Vessel identifier
   * @param newExposureSats Additional exposure amount
   * @returns Whether exposure is allowed and why
   */
  canAcceptExposure(
    vesselMmsi: string,
    newExposureSats: number
  ): ExposureCheck {
    // 1. Check pool capacity
    const availableCapacity = this.getAvailableCapacity();
    if (newExposureSats > availableCapacity) {
      return {
        allowed: false,
        reason: 'Insufficient pool capacity',
        currentVesselExposure: this.vesselExposure.get(vesselMmsi) || 0,
        maxVesselExposure: this.getMaxVesselExposure(),
        currentPoolUtilization: this.getUtilizationRatio(),
      };
    }

    // 2. Check vessel concentration limit
    const currentVesselExposure = this.vesselExposure.get(vesselMmsi) || 0;
    const totalVesselExposure = currentVesselExposure + newExposureSats;
    const maxVesselExposure = this.getMaxVesselExposure();

    if (totalVesselExposure > maxVesselExposure) {
      return {
        allowed: false,
        reason: `Vessel exposure limit exceeded (max ${maxVesselExposure} sats, requested ${totalVesselExposure} sats)`,
        currentVesselExposure,
        maxVesselExposure,
        currentPoolUtilization: this.getUtilizationRatio(),
      };
    }

    // 3. Check reserve requirements
    const newTotalExposure = this.totalExposureSats + newExposureSats;
    const minReserve = this.config.poolCapacitySats * this.config.minPoolReserveRatio;
    const remainingReserve = this.config.poolCapacitySats - newTotalExposure;

    if (remainingReserve < minReserve) {
      return {
        allowed: false,
        reason: `Minimum reserve requirement not met (${minReserve} sats required)`,
        currentVesselExposure,
        maxVesselExposure,
        currentPoolUtilization: newTotalExposure / this.config.poolCapacitySats,
      };
    }

    // All checks passed
    return {
      allowed: true,
      currentVesselExposure,
      maxVesselExposure,
      currentPoolUtilization: this.getUtilizationRatio(),
    };
  }

  /**
   * Add exposure when policy is issued
   */
  addExposure(policy: MicroPolicy): void {
    const exposureAmount = policy.coverageSats;

    // Update total exposure
    this.totalExposureSats += exposureAmount;

    // Update vessel exposure
    const currentVesselExposure = this.vesselExposure.get(policy.vesselMmsi) || 0;
    this.vesselExposure.set(policy.vesselMmsi, currentVesselExposure + exposureAmount);

    // Update zone exposure
    const currentZoneExposure = this.zoneExposure.get(policy.zoneId) || 0;
    this.zoneExposure.set(policy.zoneId, currentZoneExposure + exposureAmount);

    console.log(
      `[Treasury] Added exposure: ${exposureAmount} sats ` +
        `(total: ${this.totalExposureSats} / ${this.config.poolCapacitySats})`
    );
  }

  /**
   * Remove exposure when policy expires or is claimed
   */
  removeExposure(policy: MicroPolicy): void {
    const exposureAmount = policy.coverageSats;

    // Update total exposure
    this.totalExposureSats = Math.max(0, this.totalExposureSats - exposureAmount);

    // Update vessel exposure
    const currentVesselExposure = this.vesselExposure.get(policy.vesselMmsi) || 0;
    const newVesselExposure = Math.max(0, currentVesselExposure - exposureAmount);
    if (newVesselExposure === 0) {
      this.vesselExposure.delete(policy.vesselMmsi);
    } else {
      this.vesselExposure.set(policy.vesselMmsi, newVesselExposure);
    }

    // Update zone exposure
    const currentZoneExposure = this.zoneExposure.get(policy.zoneId) || 0;
    const newZoneExposure = Math.max(0, currentZoneExposure - exposureAmount);
    if (newZoneExposure === 0) {
      this.zoneExposure.delete(policy.zoneId);
    } else {
      this.zoneExposure.set(policy.zoneId, newZoneExposure);
    }

    console.log(
      `[Treasury] Removed exposure: ${exposureAmount} sats ` +
        `(total: ${this.totalExposureSats} / ${this.config.poolCapacitySats})`
    );
  }

  /**
   * Record premium payment received
   */
  recordPremiumInflow(amountSats: number): void {
    this.currentBalanceSats += amountSats;
    this.premiumInflows.push({ timestamp: Date.now(), amount: amountSats });
    this.cleanupOldCashFlows();

    console.log(`[Treasury] Premium received: ${amountSats} sats (balance: ${this.currentBalanceSats})`);
  }

  /**
   * Record claim payment made
   */
  recordClaimOutflow(amountSats: number): void {
    this.currentBalanceSats -= amountSats;
    this.claimOutflows.push({ timestamp: Date.now(), amount: amountSats });
    this.cleanupOldCashFlows();

    console.log(`[Treasury] Claim paid: ${amountSats} sats (balance: ${this.currentBalanceSats})`);
  }

  /**
   * Get current pool utilization (0.0 to 1.0)
   */
  getUtilizationRatio(): number {
    return this.totalExposureSats / this.config.poolCapacitySats;
  }

  /**
   * Get available capacity for new policies
   */
  getAvailableCapacity(): number {
    const minReserve = this.config.poolCapacitySats * this.config.minPoolReserveRatio;
    const usableCapacity = this.config.poolCapacitySats - minReserve;
    const availableCapacity = usableCapacity - this.totalExposureSats;
    return Math.max(0, availableCapacity);
  }

  /**
   * Get maximum exposure allowed for a single vessel
   */
  getMaxVesselExposure(): number {
    return this.config.poolCapacitySats * this.config.maxVesselExposureRatio;
  }

  /**
   * Check if pool needs rebalancing
   */
  needsRebalancing(): boolean {
    const currentReserve = this.config.poolCapacitySats - this.totalExposureSats;
    const reserveRatio = currentReserve / this.config.poolCapacitySats;
    return reserveRatio < this.config.rebalanceThresholdRatio;
  }

  /**
   * Get treasury statistics
   */
  getStats(): TreasuryStats {
    const currentReserve = this.config.poolCapacitySats - this.totalExposureSats;
    const reserveRatio = currentReserve / this.config.poolCapacitySats;

    // Calculate 24h cash flows
    const premiumIncome24h = this.getCashFlow24h(this.premiumInflows);
    const claimsPaid24h = this.getCashFlow24h(this.claimOutflows);
    const netIncome24h = premiumIncome24h - claimsPaid24h;

    // Convert exposure maps to objects
    const exposureByVessel: Record<string, number> = {};
    for (const [mmsi, exposure] of this.vesselExposure.entries()) {
      exposureByVessel[mmsi] = exposure;
    }

    const exposureByZone: Record<string, number> = {};
    for (const [zone, exposure] of this.zoneExposure.entries()) {
      exposureByZone[zone] = exposure;
    }

    return {
      poolCapacitySats: this.config.poolCapacitySats,
      currentBalanceSats: this.currentBalanceSats,
      totalExposureSats: this.totalExposureSats,
      availableCapacitySats: this.getAvailableCapacity(),
      reserveSats: currentReserve,
      utilizationRatio: this.getUtilizationRatio(),
      reserveRatio,
      needsRebalancing: this.needsRebalancing(),
      premiumIncome24h,
      claimsPaid24h,
      netIncome24h,
      exposureByVessel,
      exposureByZone,
    };
  }

  /**
   * Get vessel exposure
   */
  getVesselExposure(mmsi: string): number {
    return this.vesselExposure.get(mmsi) || 0;
  }

  /**
   * Get zone exposure
   */
  getZoneExposure(zoneId: string): number {
    return this.zoneExposure.get(zoneId) || 0;
  }

  // Private helpers

  private getCashFlow24h(flows: Array<{ timestamp: number; amount: number }>): number {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    return flows
      .filter(f => f.timestamp >= cutoff)
      .reduce((sum, f) => sum + f.amount, 0);
  }

  private cleanupOldCashFlows(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // Keep last 24h
    this.premiumInflows = this.premiumInflows.filter(f => f.timestamp >= cutoff);
    this.claimOutflows = this.claimOutflows.filter(f => f.timestamp >= cutoff);
  }
}
