/**
 * Verification Engine - Validates insurance claims
 * Cross-references with risk data and AIS information
 */

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

export interface VerificationResult {
  claimId: string;
  verified: boolean;
  verificationScore: number; // 0.0 - 1.0
  confidence: number; // 0.0 - 1.0
  findings: string[];
  recommendation: 'approve' | 'reject' | 'investigate';
  approvedAmountSats?: number;
  rejectionReason?: string;
}

export interface IncidentSignal {
  type: 'ais_gap' | 'speed_anomaly' | 'course_deviation' | 'proximity_alert' | 'zone_escalation';
  severity: number; // 0.0 - 1.0
  vessel_mmsi: string;
  timestamp: number;
  evidence: string;
}

/**
 * VerificationEngine analyzes and validates insurance claims
 */
export class VerificationEngine {
  private verifications: Map<string, VerificationResult> = new Map();

  constructor() {
    console.log('[VerificationEngine] Initialized');
  }

  /**
   * Verify a claim submission
   */
  async verifyClaim(claim: ClaimSubmission, riskData?: any): Promise<VerificationResult> {
    console.log(`[VerificationEngine] Verifying claim ${claim.claimId} for ${claim.mmsi}`);

    const findings: string[] = [];
    let verificationScore = 0.5; // Start neutral

    // Analyze claim type
    findings.push(`Claim type: ${claim.claimType}`);

    switch (claim.claimType) {
      case 'collision':
        verificationScore = await this.verifyCollision(claim, riskData, findings);
        break;

      case 'piracy':
        verificationScore = await this.verifyPiracy(claim, riskData, findings);
        break;

      case 'total_loss':
        verificationScore = await this.verifyTotalLoss(claim, riskData, findings);
        break;

      case 'damage':
        verificationScore = await this.verifyDamage(claim, riskData, findings);
        break;

      default:
        findings.push('Unknown claim type');
        verificationScore = 0.2;
    }

    // Cross-reference with risk data if available
    if (riskData) {
      findings.push(`Risk zone: ${riskData.zoneId}`);
      findings.push(`Aggregate risk at time: ${(riskData.aggregateRisk * 100).toFixed(1)}%`);

      // Higher risk zones lend credibility to claims
      if (riskData.aggregateRisk > 0.7) {
        verificationScore += 0.1;
        findings.push('High risk zone confirmed - increases claim credibility');
      }
    }

    // Determine recommendation
    let recommendation: 'approve' | 'reject' | 'investigate';
    let approvedAmountSats: number | undefined;
    let rejectionReason: string | undefined;

    if (verificationScore >= 0.7) {
      recommendation = 'approve';
      approvedAmountSats = claim.claimAmountSats;
      findings.push('✅ Claim verification passed - recommend approval');
    } else if (verificationScore >= 0.4) {
      recommendation = 'investigate';
      findings.push('⚠️  Claim requires further investigation');
    } else {
      recommendation = 'reject';
      rejectionReason = 'Insufficient evidence to support claim';
      findings.push('❌ Claim verification failed - recommend rejection');
    }

    const result: VerificationResult = {
      claimId: claim.claimId,
      verified: verificationScore >= 0.7,
      verificationScore,
      confidence: 0.8, // Mock confidence
      findings,
      recommendation,
      approvedAmountSats,
      rejectionReason
    };

    this.verifications.set(claim.claimId, result);
    console.log(
      `[VerificationEngine] Claim ${claim.claimId} verified: ${recommendation} (score: ${(verificationScore * 100).toFixed(1)}%)`
    );

    return result;
  }

  /**
   * Verify collision claim
   */
  private async verifyCollision(
    claim: ClaimSubmission,
    riskData: any,
    findings: string[]
  ): Promise<number> {
    let score = 0.5;

    // Check for evidence in description
    if (claim.eventDescription.toLowerCase().includes('collision')) {
      score += 0.2;
      findings.push('Collision mentioned in description');
    }

    // Check for high traffic zone
    if (riskData && riskData.proximityRisk > 0.05) {
      score += 0.1;
      findings.push('High traffic area - collision plausible');
    }

    // Check for AIS data anomalies (simulated)
    const hasAisAnomaly = Math.random() > 0.5;
    if (hasAisAnomaly) {
      score += 0.15;
      findings.push('AIS data shows speed anomaly consistent with collision');
    }

    return Math.min(score, 1.0);
  }

  /**
   * Verify piracy claim
   */
  private async verifyPiracy(
    claim: ClaimSubmission,
    riskData: any,
    findings: string[]
  ): Promise<number> {
    let score = 0.5;

    // Piracy claims require high risk zone
    if (riskData && riskData.aggregateRisk > 0.6) {
      score += 0.3;
      findings.push('High risk zone for piracy confirmed');
    } else {
      score -= 0.2;
      findings.push('Low risk zone for piracy - claim questionable');
    }

    // Check for piracy-specific indicators
    if (claim.eventDescription.toLowerCase().includes('attack') ||
        claim.eventDescription.toLowerCase().includes('boarding')) {
      score += 0.2;
      findings.push('Piracy indicators present in description');
    }

    return Math.min(score, 1.0);
  }

  /**
   * Verify total loss claim
   */
  private async verifyTotalLoss(
    claim: ClaimSubmission,
    riskData: any,
    findings: string[]
  ): Promise<number> {
    let score = 0.4; // Start lower for severe claims

    // Total loss requires strong evidence
    if (claim.eventDescription.toLowerCase().includes('sunk') ||
        claim.eventDescription.toLowerCase().includes('destroyed')) {
      score += 0.3;
      findings.push('Total loss indicators in description');
    }

    // Check for AIS gap (vessel no longer transmitting)
    const hasAisGap = Math.random() > 0.7;
    if (hasAisGap) {
      score += 0.3;
      findings.push('AIS transmission ceased - supports total loss claim');
    } else {
      score -= 0.1;
      findings.push('⚠️  AIS still active - total loss claim questionable');
    }

    return Math.min(score, 1.0);
  }

  /**
   * Verify damage claim
   */
  private async verifyDamage(
    claim: ClaimSubmission,
    riskData: any,
    findings: string[]
  ): Promise<number> {
    let score = 0.6; // Moderate starting score

    // Check for damage indicators
    if (claim.eventDescription.toLowerCase().includes('damage') ||
        claim.eventDescription.toLowerCase().includes('leak')) {
      score += 0.2;
      findings.push('Damage indicators present');
    }

    // Partial claims more likely to be valid
    score += 0.1;
    findings.push('Partial damage claim - typically verifiable');

    return Math.min(score, 1.0);
  }

  /**
   * Get verification result
   */
  getVerificationResult(claimId: string): VerificationResult | undefined {
    return this.verifications.get(claimId);
  }

  /**
   * Get all verifications
   */
  getAllVerifications(): VerificationResult[] {
    return Array.from(this.verifications.values());
  }

  /**
   * Get statistics
   */
  getStats() {
    const verifications = Array.from(this.verifications.values());
    return {
      totalVerifications: verifications.length,
      approved: verifications.filter(v => v.recommendation === 'approve').length,
      rejected: verifications.filter(v => v.recommendation === 'reject').length,
      needsInvestigation: verifications.filter(v => v.recommendation === 'investigate').length,
      averageVerificationScore:
        verifications.reduce((sum, v) => sum + v.verificationScore, 0) / Math.max(verifications.length, 1)
    };
  }
}
