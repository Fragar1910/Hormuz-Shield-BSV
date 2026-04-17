/**
 * Insurer Pool - Policy Manager
 * Emission and tracking of micro-insurance policies
 *
 * Each policy:
 * - Typically 60 seconds duration (1-minute micro-policies)
 * - Registered on-chain via OP_RETURN (future)
 * - Active tracking in memory for fast queries
 */

import { MicroPolicy, RiskScore } from '@hormuz/shared';
import { PricingEngine } from './pricing-engine.js';

export interface PolicyIssuanceRequest {
  vesselMmsi: string;
  zoneId: string;
  hullValueUsd: number;
  durationSeconds: number;
  riskScore: RiskScore;
  premiumTxid: string; // BSV transaction paying the premium
  poolUtilization: number;
}

export interface PolicyStats {
  totalPoliciesIssued: number;
  activePolicies: number;
  expiredPolicies: number;
  claimedPolicies: number;
  totalPremiumsCollected: number;
  totalClaimsPaid: number;
  averagePolicyDuration: number;
  policyCountByZone: Record<string, number>;
  policyCountByVessel: Record<string, number>;
}

export class PolicyManager {
  private policies: Map<string, MicroPolicy> = new Map();
  private pricingEngine: PricingEngine;
  private totalPremiumsCollected = 0;
  private totalClaimsPaid = 0;

  // Tracking for vessel-specific stats
  private vesselPolicies: Map<string, string[]> = new Map(); // mmsi → policy_ids
  private zonePolicies: Map<string, string[]> = new Map(); // zone_id → policy_ids

  constructor(pricingEngine: PricingEngine) {
    this.pricingEngine = pricingEngine;
  }

  /**
   * Issue a new micro-policy
   *
   * @param request Policy issuance parameters
   * @returns Issued policy
   * @throws Error if validation fails
   */
  issuePolicy(request: PolicyIssuanceRequest): MicroPolicy {
    // 1. Calculate pricing
    const pricing = this.pricingEngine.calculatePremium({
      hullValueUsd: request.hullValueUsd,
      durationSeconds: request.durationSeconds,
      riskScore: request.riskScore,
      poolUtilization: request.poolUtilization,
    });

    // 2. Generate unique policy ID
    const policyId = this.generatePolicyId();

    // 3. Create policy
    const policy: MicroPolicy = {
      policyId,
      vesselMmsi: request.vesselMmsi,
      zoneId: request.zoneId,
      startTime: Date.now(),
      durationSeconds: request.durationSeconds,
      hullValueUsd: request.hullValueUsd,
      premiumSats: pricing.premiumSats,
      coverageSats: pricing.coverageSats,
      riskScoreAtIssuance: request.riskScore.aggregateRisk,
      status: 'active',
      txid: request.premiumTxid,
    };

    // 4. Store policy
    this.policies.set(policyId, policy);
    this.totalPremiumsCollected += pricing.premiumSats;

    // 5. Track by vessel and zone
    this.trackPolicyByVessel(request.vesselMmsi, policyId);
    this.trackPolicyByZone(request.zoneId, policyId);

    console.log(
      `[PolicyManager] Policy issued: ${policyId} for vessel ${request.vesselMmsi} ` +
        `(${pricing.coverageSats} sats coverage, ${pricing.premiumSats} sats premium, ` +
        `${request.durationSeconds}s duration)`
    );

    return policy;
  }

  /**
   * Get policy by ID
   */
  getPolicy(policyId: string): MicroPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all active policies
   */
  getActivePolicies(): MicroPolicy[] {
    const now = Date.now();
    return Array.from(this.policies.values()).filter(
      p => p.status === 'active' && this.getPolicyEndTime(p) > now
    );
  }

  /**
   * Get active policies for a vessel
   */
  getVesselPolicies(mmsi: string, activeOnly = true): MicroPolicy[] {
    const policyIds = this.vesselPolicies.get(mmsi) || [];
    const policies = policyIds
      .map(id => this.policies.get(id))
      .filter((p): p is MicroPolicy => p !== undefined);

    if (!activeOnly) return policies;

    const now = Date.now();
    return policies.filter(
      p => p.status === 'active' && this.getPolicyEndTime(p) > now
    );
  }

  /**
   * Get active policies in a zone
   */
  getZonePolicies(zoneId: string, activeOnly = true): MicroPolicy[] {
    const policyIds = this.zonePolicies.get(zoneId) || [];
    const policies = policyIds
      .map(id => this.policies.get(id))
      .filter((p): p is MicroPolicy => p !== undefined);

    if (!activeOnly) return policies;

    const now = Date.now();
    return policies.filter(
      p => p.status === 'active' && this.getPolicyEndTime(p) > now
    );
  }

  /**
   * Check if a policy has expired and update status
   */
  checkExpiration(policyId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return true;

    const now = Date.now();
    const endTime = this.getPolicyEndTime(policy);
    const expired = endTime < now;

    if (expired && policy.status === 'active') {
      policy.status = 'expired';
      console.log(`[PolicyManager] Policy expired: ${policyId}`);
    }

    return expired;
  }

  /**
   * Expire all policies that have exceeded their duration
   * Should be called periodically (e.g., every 10 seconds)
   */
  expireOldPolicies(): number {
    let expiredCount = 0;
    const now = Date.now();

    for (const policy of this.policies.values()) {
      if (policy.status === 'active' && this.getPolicyEndTime(policy) < now) {
        policy.status = 'expired';
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`[PolicyManager] Expired ${expiredCount} policies`);
    }

    return expiredCount;
  }

  /**
   * Mark policy as claimed
   */
  markAsClaimed(policyId: string, claimAmountSats: number): boolean {
    const policy = this.policies.get(policyId);
    if (!policy || policy.status !== 'active') {
      return false;
    }

    if (this.checkExpiration(policyId)) {
      return false; // Can't claim expired policy
    }

    policy.status = 'claimed';
    this.totalClaimsPaid += claimAmountSats;

    console.log(
      `[PolicyManager] Policy claimed: ${policyId} for ${claimAmountSats} sats`
    );

    return true;
  }

  /**
   * Get statistics
   */
  getStats(): PolicyStats {
    const allPolicies = Array.from(this.policies.values());
    const now = Date.now();

    const activePolicies = allPolicies.filter(
      p => p.status === 'active' && this.getPolicyEndTime(p) > now
    );
    const expiredPolicies = allPolicies.filter(p => p.status === 'expired');
    const claimedPolicies = allPolicies.filter(p => p.status === 'claimed');

    // Calculate average policy duration
    const totalDuration = allPolicies.reduce(
      (sum, p) => sum + p.durationSeconds,
      0
    );
    const averagePolicyDuration =
      allPolicies.length > 0 ? totalDuration / allPolicies.length : 0;

    // Count by zone
    const policyCountByZone: Record<string, number> = {};
    for (const [zoneId, policyIds] of this.zonePolicies.entries()) {
      policyCountByZone[zoneId] = policyIds.length;
    }

    // Count by vessel
    const policyCountByVessel: Record<string, number> = {};
    for (const [mmsi, policyIds] of this.vesselPolicies.entries()) {
      policyCountByVessel[mmsi] = policyIds.length;
    }

    return {
      totalPoliciesIssued: this.policies.size,
      activePolicies: activePolicies.length,
      expiredPolicies: expiredPolicies.length,
      claimedPolicies: claimedPolicies.length,
      totalPremiumsCollected: this.totalPremiumsCollected,
      totalClaimsPaid: this.totalClaimsPaid,
      averagePolicyDuration,
      policyCountByZone,
      policyCountByVessel,
    };
  }

  /**
   * Get vessel-specific loss ratio
   */
  getVesselLossRatio(mmsi: string): number {
    const policies = this.getVesselPolicies(mmsi, false);
    const totalPremiums = policies.reduce((sum, p) => sum + p.premiumSats, 0);
    const claimedPolicies = policies.filter(p => p.status === 'claimed');
    const totalClaims = claimedPolicies.reduce(
      (sum, p) => sum + p.coverageSats,
      0
    );

    return this.pricingEngine.calculateLossRatio(totalClaims, totalPremiums);
  }

  /**
   * Clear expired policies from memory (cleanup)
   * Should be called periodically to prevent memory bloat
   */
  cleanupExpiredPolicies(olderThanMs = 3600_000): number {
    const cutoff = Date.now() - olderThanMs;
    let cleanedCount = 0;

    for (const [policyId, policy] of this.policies.entries()) {
      const endTime = this.getPolicyEndTime(policy);
      if (policy.status === 'expired' && endTime < cutoff) {
        this.policies.delete(policyId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(
        `[PolicyManager] Cleaned up ${cleanedCount} expired policies older than ${olderThanMs / 1000}s`
      );
    }

    return cleanedCount;
  }

  // Private helpers

  private generatePolicyId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `POL-${timestamp}-${random}`.toUpperCase();
  }

  private getPolicyEndTime(policy: MicroPolicy): number {
    return policy.startTime + policy.durationSeconds * 1000;
  }

  private trackPolicyByVessel(mmsi: string, policyId: string): void {
    if (!this.vesselPolicies.has(mmsi)) {
      this.vesselPolicies.set(mmsi, []);
    }
    this.vesselPolicies.get(mmsi)!.push(policyId);
  }

  private trackPolicyByZone(zoneId: string, policyId: string): void {
    if (!this.zonePolicies.has(zoneId)) {
      this.zonePolicies.set(zoneId, []);
    }
    this.zonePolicies.get(zoneId)!.push(policyId);
  }
}
