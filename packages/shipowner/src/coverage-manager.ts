/**
 * Coverage Manager - Handles insurance coverage requests
 * Interacts with Insurer Pool via BRC-100 MessageBox
 */

import { MessageBoxManager, AgentMessage } from '@hormuz/shared';
import type { Vessel } from './fleet-simulator';

export interface PolicyRequest {
  mmsi: string;
  zoneId: string;
  hullValueUsd: number;
  durationSeconds: number;
  riskScore?: any;
}

export interface ActivePolicy {
  policyId: string;
  mmsi: string;
  zoneId: string;
  coverageSats: number;
  premiumSats: number;
  startTime: number;
  endTime: number;
  insurerIdentity: string;
}

/**
 * CoverageManager manages insurance policy requests for the fleet
 */
export class CoverageManager {
  private activePolicies: Map<string, ActivePolicy> = new Map();
  private pendingRequests: Map<string, PolicyRequest> = new Map();

  constructor(private messageBox: MessageBoxManager) {
    console.log('[CoverageManager] Initialized');
  }

  /**
   * Request coverage for a vessel via MessageBox
   */
  async requestCoverage(
    vessel: Vessel,
    zoneId: string,
    durationSeconds: number,
    insurerIdentity: string,
    oracleIdentity: string,
    riskScore: any
  ): Promise<void> {
    const requestId = `REQ-${vessel.mmsi}-${Date.now()}`;

    console.log(`[CoverageManager] Requesting coverage for ${vessel.mmsi} in ${zoneId}`);

    const request: PolicyRequest = {
      mmsi: vessel.mmsi,
      zoneId,
      hullValueUsd: vessel.hullValueUsd,
      durationSeconds,
      riskScore
    };

    this.pendingRequests.set(requestId, request);

    // Send policy request via MessageBox
    const message: AgentMessage = {
      from: this.messageBox.getIdentityKey(),
      to: insurerIdentity,
      type: 'policy_request',
      payload: {
        mmsi: vessel.mmsi,
        zoneId,
        hullValueUsd: vessel.hullValueUsd,
        duration: durationSeconds,
        oracleIdentity,
        riskScore
      },
      timestamp: Date.now()
    };

    await this.messageBox.sendLiveMessage(insurerIdentity, 'insurance_requests', message);
    console.log(`[CoverageManager] Policy request sent for ${vessel.mmsi}`);
  }

  /**
   * Handle policy response from insurer
   */
  handlePolicyResponse(message: AgentMessage): void {
    const { quote, policyId } = message.payload;

    if (!quote) {
      console.log(`[CoverageManager] Policy request failed: ${message.payload.error}`);
      return;
    }

    const policy: ActivePolicy = {
      policyId: policyId || `POL-${Date.now()}`,
      mmsi: quote.mmsi || '',
      zoneId: quote.zoneId || '',
      coverageSats: quote.coverage || 0,
      premiumSats: quote.premium || 0,
      startTime: Date.now(),
      endTime: Date.now() + (quote.duration || 60) * 1000,
      insurerIdentity: message.from
    };

    this.activePolicies.set(policy.policyId, policy);
    console.log(
      `[CoverageManager] ✅ Policy activated: ${policy.policyId} for ${policy.mmsi} (${policy.coverageSats} sats coverage, ${policy.premiumSats} sats premium)`
    );
  }

  /**
   * Get active policies
   */
  getActivePolicies(): ActivePolicy[] {
    return Array.from(this.activePolicies.values());
  }

  /**
   * Get policy for vessel
   */
  getPolicyForVessel(mmsi: string): ActivePolicy | undefined {
    return Array.from(this.activePolicies.values()).find(p => p.mmsi === mmsi);
  }

  /**
   * Check if vessel has active coverage
   */
  hasActiveCoverage(mmsi: string, zoneId: string): boolean {
    const now = Date.now();
    return Array.from(this.activePolicies.values()).some(
      p => p.mmsi === mmsi && p.zoneId === zoneId && p.endTime > now
    );
  }

  /**
   * Remove expired policies
   */
  cleanupExpiredPolicies(): void {
    const now = Date.now();
    let expired = 0;

    this.activePolicies.forEach((policy, policyId) => {
      if (policy.endTime <= now) {
        this.activePolicies.delete(policyId);
        expired++;
      }
    });

    if (expired > 0) {
      console.log(`[CoverageManager] Cleaned up ${expired} expired policies`);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activePolicies: this.activePolicies.size,
      pendingRequests: this.pendingRequests.size,
      totalPremiumsPaid: Array.from(this.activePolicies.values()).reduce(
        (sum, p) => sum + p.premiumSats,
        0
      ),
      totalCoverageActive: Array.from(this.activePolicies.values()).reduce(
        (sum, p) => sum + p.coverageSats,
        0
      )
    };
  }
}
