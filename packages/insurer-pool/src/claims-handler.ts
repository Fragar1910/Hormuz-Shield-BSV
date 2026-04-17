/**
 * Insurer Pool - Claims Handler
 * Evaluates and processes insurance claims
 *
 * Claim flow:
 * 1. Receive claim from vessel
 * 2. Verify policy is active
 * 3. Validate claim against risk events from Oracle
 * 4. Approve/reject based on policy terms
 * 5. Settle payout if approved
 */

import { MicroPolicy, RiskScore } from '@hormuz/shared';
import { PolicyManager } from './policy-manager.js';
import { PoolTreasury } from './pool-treasury.js';

export interface ClaimRequest {
  claimId: string;
  policyId: string;
  vesselMmsi: string;
  claimType: 'total_loss' | 'partial_damage' | 'piracy' | 'collision' | 'grounding';
  claimAmountSats: number;
  timestamp: number;
  eventDescription: string;
  evidenceHash?: string; // Hash of evidence documents (future: IPFS CID)
}

export interface ClaimEvaluation {
  claimId: string;
  policyId: string;
  status: 'approved' | 'rejected' | 'under_review';
  approvedAmountSats: number;
  rejectionReason?: string;
  evaluatedAt: number;
  payoutTxid?: string;
}

export interface ClaimStats {
  totalClaimsReceived: number;
  claimsApproved: number;
  claimsRejected: number;
  claimsUnderReview: number;
  totalClaimAmountRequested: number;
  totalPayoutsSent: number;
  averageClaimAmount: number;
  lossRatio: number; // payouts / premiums
}

export class ClaimsHandler {
  private policyManager: PolicyManager;
  private treasury: PoolTreasury;
  private claims: Map<string, ClaimEvaluation> = new Map();
  private totalClaimsReceived = 0;
  private totalPayoutsSent = 0;

  constructor(policyManager: PolicyManager, treasury: PoolTreasury) {
    this.policyManager = policyManager;
    this.treasury = treasury;
  }

  /**
   * Evaluate a claim
   *
   * @param request Claim request from vessel
   * @param currentRiskScore Current risk score from oracle (for validation)
   * @returns Claim evaluation result
   */
  async evaluateClaim(
    request: ClaimRequest,
    currentRiskScore?: RiskScore
  ): Promise<ClaimEvaluation> {
    this.totalClaimsReceived++;

    console.log(`[Claims] Evaluating claim ${request.claimId} for policy ${request.policyId}`);

    // 1. Retrieve policy
    const policy = this.policyManager.getPolicy(request.policyId);
    if (!policy) {
      return this.rejectClaim(request, 'Policy not found');
    }

    // 2. Verify policy belongs to vessel
    if (policy.vesselMmsi !== request.vesselMmsi) {
      return this.rejectClaim(request, 'Policy does not belong to this vessel');
    }

    // 3. Check policy status
    if (policy.status !== 'active') {
      return this.rejectClaim(request, `Policy is not active (status: ${policy.status})`);
    }

    // 4. Check if policy has expired
    if (this.policyManager.checkExpiration(request.policyId)) {
      return this.rejectClaim(request, 'Policy has expired');
    }

    // 5. Verify claim timestamp is within policy period
    const policyStart = policy.startTime;
    const policyEnd = policyStart + policy.durationSeconds * 1000;
    if (request.timestamp < policyStart || request.timestamp > policyEnd) {
      return this.rejectClaim(
        request,
        'Claim timestamp outside policy coverage period'
      );
    }

    // 6. Verify claim amount does not exceed coverage
    if (request.claimAmountSats > policy.coverageSats) {
      return this.rejectClaim(
        request,
        `Claim amount (${request.claimAmountSats} sats) exceeds coverage (${policy.coverageSats} sats)`
      );
    }

    // 7. Validate claim type against risk events
    // For MVP, we auto-approve if all validations pass
    // In production, this would check against verifier agent
    const isValidEvent = this.validateClaimEvent(request, currentRiskScore);
    if (!isValidEvent) {
      return this.putUnderReview(
        request,
        'Claim event requires manual verification'
      );
    }

    // 8. All checks passed - approve claim
    return this.approveClaim(request, request.claimAmountSats);
  }

  /**
   * Process approved claim payout
   *
   * @param claimId Claim identifier
   * @returns Transaction ID of payout (placeholder for MVP)
   */
  async processClaimPayout(claimId: string): Promise<string> {
    const evaluation = this.claims.get(claimId);
    if (!evaluation || evaluation.status !== 'approved') {
      throw new Error('Claim not approved or not found');
    }

    const policy = this.policyManager.getPolicy(evaluation.policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    // TODO: Create real BSV transaction to vessel address
    // For MVP, we use a placeholder
    const payoutTxid = this.generatePlaceholderTxid();

    // Update treasury
    this.treasury.recordClaimOutflow(evaluation.approvedAmountSats);
    this.treasury.removeExposure(policy);

    // Update policy status
    this.policyManager.markAsClaimed(
      evaluation.policyId,
      evaluation.approvedAmountSats
    );

    // Update evaluation
    evaluation.payoutTxid = payoutTxid;
    this.totalPayoutsSent += evaluation.approvedAmountSats;

    console.log(
      `[Claims] Payout processed: ${evaluation.approvedAmountSats} sats ` +
        `(txid: ${payoutTxid})`
    );

    return payoutTxid;
  }

  /**
   * Get claim evaluation
   */
  getClaim(claimId: string): ClaimEvaluation | undefined {
    return this.claims.get(claimId);
  }

  /**
   * Get all claims for a policy
   */
  getPolicyClaims(policyId: string): ClaimEvaluation[] {
    return Array.from(this.claims.values()).filter(
      c => c.policyId === policyId
    );
  }

  /**
   * Get claims statistics
   */
  getStats(): ClaimStats {
    const allClaims = Array.from(this.claims.values());
    const approved = allClaims.filter(c => c.status === 'approved');
    const rejected = allClaims.filter(c => c.status === 'rejected');
    const underReview = allClaims.filter(c => c.status === 'under_review');

    const totalClaimAmountRequested = allClaims.reduce(
      (sum, c) => sum + c.approvedAmountSats,
      0
    );

    const averageClaimAmount =
      approved.length > 0
        ? approved.reduce((sum, c) => sum + c.approvedAmountSats, 0) /
          approved.length
        : 0;

    const policyStats = this.policyManager.getStats();
    const lossRatio =
      policyStats.totalPremiumsCollected > 0
        ? this.totalPayoutsSent / policyStats.totalPremiumsCollected
        : 0;

    return {
      totalClaimsReceived: this.totalClaimsReceived,
      claimsApproved: approved.length,
      claimsRejected: rejected.length,
      claimsUnderReview: underReview.length,
      totalClaimAmountRequested,
      totalPayoutsSent: this.totalPayoutsSent,
      averageClaimAmount,
      lossRatio,
    };
  }

  // Private helpers

  private approveClaim(
    request: ClaimRequest,
    approvedAmount: number
  ): ClaimEvaluation {
    const evaluation: ClaimEvaluation = {
      claimId: request.claimId,
      policyId: request.policyId,
      status: 'approved',
      approvedAmountSats: approvedAmount,
      evaluatedAt: Date.now(),
    };

    this.claims.set(request.claimId, evaluation);

    console.log(
      `[Claims] ✅ Claim approved: ${request.claimId} for ${approvedAmount} sats`
    );

    return evaluation;
  }

  private rejectClaim(request: ClaimRequest, reason: string): ClaimEvaluation {
    const evaluation: ClaimEvaluation = {
      claimId: request.claimId,
      policyId: request.policyId,
      status: 'rejected',
      approvedAmountSats: 0,
      rejectionReason: reason,
      evaluatedAt: Date.now(),
    };

    this.claims.set(request.claimId, evaluation);

    console.log(`[Claims] ❌ Claim rejected: ${request.claimId} - ${reason}`);

    return evaluation;
  }

  private putUnderReview(
    request: ClaimRequest,
    reason: string
  ): ClaimEvaluation {
    const evaluation: ClaimEvaluation = {
      claimId: request.claimId,
      policyId: request.policyId,
      status: 'under_review',
      approvedAmountSats: 0,
      rejectionReason: reason,
      evaluatedAt: Date.now(),
    };

    this.claims.set(request.claimId, evaluation);

    console.log(`[Claims] 🔍 Claim under review: ${request.claimId} - ${reason}`);

    return evaluation;
  }

  /**
   * Validate claim event against risk data
   * In production, this would query the Claims Verifier agent
   */
  private validateClaimEvent(
    request: ClaimRequest,
    currentRiskScore?: RiskScore
  ): boolean {
    // MVP: Auto-approve high-risk events
    // Production: Query verifier for incident confirmation
    if (!currentRiskScore) {
      return false; // Need risk data to validate
    }

    // High-risk zones automatically validate claims
    if (currentRiskScore.aggregateRisk > 0.7) {
      return true;
    }

    // Specific claim types
    switch (request.claimType) {
      case 'piracy':
      case 'collision':
      case 'grounding':
        // These should be verified by AIS data
        return currentRiskScore.aggregateRisk > 0.5;

      case 'total_loss':
      case 'partial_damage':
        // Requires manual verification
        return false;

      default:
        return false;
    }
  }

  private generatePlaceholderTxid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `claim-payout-${timestamp}-${random}`;
  }
}
