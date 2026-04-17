/**
 * Claim Filer - Handles claim filing and tracking
 * Submits claims to Claims Verifier via BRC-100 MessageBox
 */

import { MessageBoxManager, AgentMessage } from '@hormuz/shared';
import type { ActivePolicy } from './coverage-manager';

export interface ClaimSubmission {
  claimId: string;
  policyId: string;
  mmsi: string;
  claimType: 'collision' | 'piracy' | 'total_loss' | 'damage';
  claimAmountSats: number;
  timestamp: number;
  eventDescription: string;
  evidenceData?: any;
}

export interface ClaimStatus {
  claimId: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  approvedAmountSats?: number;
  rejectionReason?: string;
  payoutTxid?: string;
}

/**
 * ClaimFiler manages insurance claim submissions
 */
export class ClaimFiler {
  private claims: Map<string, ClaimStatus> = new Map();

  constructor(private messageBox: MessageBoxManager) {
    console.log('[ClaimFiler] Initialized');
  }

  /**
   * File a claim with the insurer
   */
  async fileClaim(
    policy: ActivePolicy,
    claimType: 'collision' | 'piracy' | 'total_loss' | 'damage',
    claimAmountSats: number,
    eventDescription: string,
    insurerIdentity: string
  ): Promise<string> {
    const claimId = `CLAIM-${policy.mmsi}-${Date.now()}`;

    console.log(
      `[ClaimFiler] Filing claim ${claimId} for policy ${policy.policyId} (${claimAmountSats} sats)`
    );

    const claim: ClaimSubmission = {
      claimId,
      policyId: policy.policyId,
      mmsi: policy.mmsi,
      claimType,
      claimAmountSats,
      timestamp: Date.now(),
      eventDescription
    };

    // Track claim status
    this.claims.set(claimId, {
      claimId,
      status: 'pending'
    });

    // Send claim via MessageBox
    const message: AgentMessage = {
      from: this.messageBox.getIdentityKey(),
      to: insurerIdentity,
      type: 'claim_filed',
      payload: claim,
      timestamp: Date.now()
    };

    await this.messageBox.sendLiveMessage(insurerIdentity, 'claims_inbox', message);
    console.log(`[ClaimFiler] Claim ${claimId} submitted to insurer`);

    return claimId;
  }

  /**
   * Handle claim response from insurer
   */
  handleClaimResponse(message: AgentMessage): void {
    const { claimId, status, approvedAmountSats, rejectionReason, payoutTxid } = message.payload;

    const existingClaim = this.claims.get(claimId);
    if (!existingClaim) {
      console.log(`[ClaimFiler] Received response for unknown claim: ${claimId}`);
      return;
    }

    this.claims.set(claimId, {
      claimId,
      status,
      approvedAmountSats,
      rejectionReason,
      payoutTxid
    });

    if (status === 'approved') {
      console.log(
        `[ClaimFiler] ✅ Claim approved: ${claimId} for ${approvedAmountSats} sats (txid: ${payoutTxid})`
      );
    } else if (status === 'rejected') {
      console.log(`[ClaimFiler] ❌ Claim rejected: ${claimId} - ${rejectionReason}`);
    }
  }

  /**
   * Get claim status
   */
  getClaimStatus(claimId: string): ClaimStatus | undefined {
    return this.claims.get(claimId);
  }

  /**
   * Get all claims
   */
  getAllClaims(): ClaimStatus[] {
    return Array.from(this.claims.values());
  }

  /**
   * Get statistics
   */
  getStats() {
    const claims = Array.from(this.claims.values());
    return {
      totalClaims: claims.length,
      pending: claims.filter(c => c.status === 'pending').length,
      approved: claims.filter(c => c.status === 'approved').length,
      rejected: claims.filter(c => c.status === 'rejected').length,
      paid: claims.filter(c => c.status === 'paid').length,
      totalApprovedAmount: claims
        .filter(c => c.status === 'approved' || c.status === 'paid')
        .reduce((sum, c) => sum + (c.approvedAmountSats || 0), 0)
    };
  }
}
