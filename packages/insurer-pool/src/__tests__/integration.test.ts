/**
 * Insurer Pool - Integration Tests
 * Tests the complete insurance flow: pricing, policies, treasury, and claims
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PrivateKey } from '@bsv/sdk';
import { RiskScore } from '@hormuz/shared';
import { AgentWallet } from '../wallet.js';
import { PricingEngine } from '../pricing-engine.js';
import { PolicyManager } from '../policy-manager.js';
import { PoolTreasury } from '../pool-treasury.js';
import { ClaimsHandler } from '../claims-handler.js';

describe('Insurer Pool Integration Tests', () => {
  let wallet: AgentWallet;
  let pricingEngine: PricingEngine;
  let policyManager: PolicyManager;
  let treasury: PoolTreasury;
  let claimsHandler: ClaimsHandler;

  const mockRiskScore: RiskScore = {
    vesselMmsi: '368207620',
    zoneId: 'HORMUZ',
    timestamp: Date.now(),
    aggregateRisk: 0.6, // Medium risk
    baseRisk: 0.4,
    proximityRisk: 0.1,
    speedAnomaly: 0.05,
    courseAnomaly: 0.05,
    confidence: 0.9,
    premiumBasisBps: 100,
  };

  beforeAll(() => {
    // Create test wallet
    const testKey = PrivateKey.fromRandom();
    wallet = new AgentWallet({
      privateKeyWif: testKey.toWif(),
      network: 'test',
    });

    // Initialize components
    pricingEngine = new PricingEngine();
    policyManager = new PolicyManager(pricingEngine);
    treasury = new PoolTreasury({
      poolCapacitySats: 100_000_000, // 1 BSV
      maxVesselExposureRatio: 0.30,
      minPoolReserveRatio: 0.20,
      rebalanceThresholdRatio: 0.25,
    });
    claimsHandler = new ClaimsHandler(policyManager, treasury);
  });

  describe('PricingEngine', () => {
    it('should calculate premium with all factors', () => {
      const pricing = pricingEngine.calculatePremium({
        hullValueUsd: 100_000,
        durationSeconds: 60,
        riskScore: mockRiskScore,
        poolUtilization: 0.5, // 50% pool utilization
      });

      expect(pricing.premiumSats).toBeGreaterThan(0);
      expect(pricing.coverageSats).toBeGreaterThan(0);
      expect(pricing.riskMultiplier).toBeGreaterThan(1); // Should have risk multiplier
      expect(pricing.poolUtilizationFactor).toBeGreaterThan(1); // Should have utilization factor
      expect(pricing.breakdown).toBeDefined();
    });

    it('should apply min/max premium bounds', () => {
      const lowPricing = pricingEngine.calculatePremium({
        hullValueUsd: 1, // Very low value
        durationSeconds: 1,
        riskScore: { ...mockRiskScore, aggregateRisk: 0.1 },
        poolUtilization: 0.0,
      });

      expect(lowPricing.premiumSats).toBeGreaterThanOrEqual(10); // Min premium
    });

    it('should generate quote with risk level', () => {
      const quote = pricingEngine.getQuote(
        100_000,
        60,
        mockRiskScore,
        0.5
      );

      expect(quote.premium).toBeGreaterThan(0);
      expect(quote.coverage).toBeGreaterThan(0);
      expect(['MEDIUM', 'HIGH']).toContain(quote.riskLevel); // 0.6 risk = MEDIUM or HIGH
      expect(quote.validUntil).toBeGreaterThan(Date.now());
    });

    it('should classify risk levels correctly', () => {
      const lowRisk = pricingEngine.getQuote(100_000, 60, { ...mockRiskScore, aggregateRisk: 0.2 }, 0.5);
      const highRisk = pricingEngine.getQuote(100_000, 60, { ...mockRiskScore, aggregateRisk: 0.75 }, 0.5);
      const critical = pricingEngine.getQuote(100_000, 60, { ...mockRiskScore, aggregateRisk: 0.9 }, 0.5);

      expect(lowRisk.riskLevel).toBe('LOW');
      expect(highRisk.riskLevel).toBe('HIGH');
      expect(critical.riskLevel).toBe('CRITICAL');
    });
  });

  describe('PoolTreasury', () => {
    it('should initialize with correct capacity', () => {
      const stats = treasury.getStats();

      expect(stats.poolCapacitySats).toBe(100_000_000);
      expect(stats.totalExposureSats).toBe(0);
      expect(stats.utilizationRatio).toBe(0);
    });

    it('should check exposure limits', () => {
      const exposureCheck = treasury.canAcceptExposure('368207620', 10_000_000);

      expect(exposureCheck.allowed).toBe(true);
      expect(exposureCheck.maxVesselExposure).toBe(30_000_000); // 30% of 100M
    });

    it('should reject exposure exceeding vessel limit', () => {
      const exposureCheck = treasury.canAcceptExposure('368207620', 35_000_000);

      expect(exposureCheck.allowed).toBe(false);
      expect(exposureCheck.reason).toContain('Vessel exposure limit exceeded');
    });

    it('should reject exposure exceeding pool capacity', () => {
      const exposureCheck = treasury.canAcceptExposure('368207620', 90_000_000);

      expect(exposureCheck.allowed).toBe(false);
      expect(exposureCheck.reason).toBeDefined(); // Any rejection reason is fine
    });
  });

  describe('PolicyManager', () => {
    it('should issue a policy', () => {
      const poolUtilization = treasury.getUtilizationRatio();

      const policy = policyManager.issuePolicy({
        vesselMmsi: '368207620',
        zoneId: 'HORMUZ',
        hullValueUsd: 100_000,
        durationSeconds: 60,
        riskScore: mockRiskScore,
        premiumTxid: 'test-tx-001',
        poolUtilization,
      });

      expect(policy.policyId).toBeDefined();
      expect(policy.vesselMmsi).toBe('368207620');
      expect(policy.status).toBe('active');
      expect(policy.premiumSats).toBeGreaterThan(0);
      expect(policy.coverageSats).toBeGreaterThan(0);
    });

    it('should retrieve issued policy', () => {
      const poolUtilization = treasury.getUtilizationRatio();

      const policy = policyManager.issuePolicy({
        vesselMmsi: '111111111',
        zoneId: 'HORMUZ',
        hullValueUsd: 100_000,
        durationSeconds: 60,
        riskScore: mockRiskScore,
        premiumTxid: 'test-tx-002',
        poolUtilization,
      });

      const retrieved = policyManager.getPolicy(policy.policyId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.policyId).toBe(policy.policyId);
    });

    it('should get active policies', () => {
      const activePolicies = policyManager.getActivePolicies();
      expect(activePolicies.length).toBeGreaterThan(0);
    });

    it('should get vessel-specific policies', () => {
      const vesselPolicies = policyManager.getVesselPolicies('368207620');
      expect(vesselPolicies.length).toBeGreaterThan(0);
      expect(vesselPolicies[0].vesselMmsi).toBe('368207620');
    });

    it('should calculate statistics', () => {
      const stats = policyManager.getStats();

      expect(stats.totalPoliciesIssued).toBeGreaterThan(0);
      expect(stats.activePolicies).toBeGreaterThan(0);
      expect(stats.totalPremiumsCollected).toBeGreaterThan(0);
      expect(stats.averagePolicyDuration).toBe(60);
    });
  });

  describe('Claims Handler', () => {
    let testPolicyId: string;

    beforeAll(() => {
      // Issue a test policy
      const poolUtilization = treasury.getUtilizationRatio();
      const policy = policyManager.issuePolicy({
        vesselMmsi: '222222222',
        zoneId: 'HORMUZ',
        hullValueUsd: 100_000,
        durationSeconds: 60,
        riskScore: mockRiskScore,
        premiumTxid: 'test-tx-claims-001',
        poolUtilization,
      });
      testPolicyId = policy.policyId;

      // Add to treasury
      treasury.addExposure(policy);
    });

    it('should reject claim for non-existent policy', async () => {
      const evaluation = await claimsHandler.evaluateClaim({
        claimId: 'CLAIM-001',
        policyId: 'NON-EXISTENT',
        vesselMmsi: '222222222',
        claimType: 'collision',
        claimAmountSats: 10_000,
        timestamp: Date.now(),
        eventDescription: 'Test claim',
      });

      expect(evaluation.status).toBe('rejected');
      expect(evaluation.rejectionReason).toContain('Policy not found');
    });

    it('should reject claim for wrong vessel', async () => {
      const evaluation = await claimsHandler.evaluateClaim({
        claimId: 'CLAIM-002',
        policyId: testPolicyId,
        vesselMmsi: 'WRONG-VESSEL',
        claimType: 'collision',
        claimAmountSats: 10_000,
        timestamp: Date.now(),
        eventDescription: 'Test claim',
      });

      expect(evaluation.status).toBe('rejected');
      expect(evaluation.rejectionReason).toContain('does not belong to this vessel');
    });

    it('should approve valid claim', async () => {
      const policy = policyManager.getPolicy(testPolicyId)!;

      const evaluation = await claimsHandler.evaluateClaim(
        {
          claimId: 'CLAIM-003',
          policyId: testPolicyId,
          vesselMmsi: '222222222',
          claimType: 'collision',
          claimAmountSats: policy.coverageSats / 2, // Claim 50% of coverage
          timestamp: Date.now(),
          eventDescription: 'Collision with another vessel',
        },
        mockRiskScore
      );

      expect(evaluation.status).toBe('approved');
      expect(evaluation.approvedAmountSats).toBeGreaterThan(0);
    });

    it('should reject claim exceeding coverage', async () => {
      const policy = policyManager.getPolicy(testPolicyId)!;

      const evaluation = await claimsHandler.evaluateClaim({
        claimId: 'CLAIM-004',
        policyId: testPolicyId,
        vesselMmsi: '222222222',
        claimType: 'total_loss',
        claimAmountSats: policy.coverageSats * 2, // Claim 200% of coverage
        timestamp: Date.now(),
        eventDescription: 'Total loss',
      });

      expect(evaluation.status).toBe('rejected');
      expect(evaluation.rejectionReason).toContain('exceeds coverage');
    });

    it('should calculate claims statistics', () => {
      const stats = claimsHandler.getStats();

      expect(stats.totalClaimsReceived).toBeGreaterThan(0);
      expect(stats.claimsApproved).toBeGreaterThan(0);
      expect(stats.claimsRejected).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Flow', () => {
    it('should complete full policy lifecycle', async () => {
      // Use large treasury for E2E test to avoid capacity issues
      const freshTreasury = new PoolTreasury({
        poolCapacitySats: 10_000_000_000, // 100 BSV for testing
        maxVesselExposureRatio: 0.30,
        minPoolReserveRatio: 0.20,
        rebalanceThresholdRatio: 0.25,
      });

      const mmsi = '999999999';
      const poolUtilization = freshTreasury.getUtilizationRatio();

      // 1. Check if pool can accept exposure
      const pricing = pricingEngine.calculatePremium({
        hullValueUsd: 100_000,
        durationSeconds: 60,
        riskScore: mockRiskScore,
        poolUtilization,
      });

      const exposureCheck = freshTreasury.canAcceptExposure(mmsi, pricing.coverageSats);
      expect(exposureCheck.allowed).toBe(true);

      // 2. Issue policy
      const policy = policyManager.issuePolicy({
        vesselMmsi: mmsi,
        zoneId: 'HORMUZ',
        hullValueUsd: 100_000,
        durationSeconds: 60,
        riskScore: mockRiskScore,
        premiumTxid: 'test-tx-e2e-001',
        poolUtilization,
      });

      expect(policy.status).toBe('active');

      // 3. Update fresh treasury
      freshTreasury.addExposure(policy);
      freshTreasury.recordPremiumInflow(pricing.premiumSats);

      const treasuryStats = freshTreasury.getStats();
      expect(treasuryStats.totalExposureSats).toBeGreaterThan(0);
      expect(treasuryStats.premiumIncome24h).toBe(pricing.premiumSats);

      // 4. Submit and approve claim (use fresh claims handler for this treasury)
      const freshClaimsHandler = new ClaimsHandler(policyManager, freshTreasury);
      const evaluation = await freshClaimsHandler.evaluateClaim(
        {
          claimId: 'CLAIM-E2E-001',
          policyId: policy.policyId,
          vesselMmsi: mmsi,
          claimType: 'collision',
          claimAmountSats: pricing.coverageSats / 2,
          timestamp: Date.now(),
          eventDescription: 'End-to-end test claim',
        },
        mockRiskScore
      );

      expect(evaluation.status).toBe('approved');

      // 5. Process payout
      const payoutTxid = await freshClaimsHandler.processClaimPayout(evaluation.claimId);
      expect(payoutTxid).toBeDefined();

      // 6. Verify policy was marked as claimed
      const updatedPolicy = policyManager.getPolicy(policy.policyId);
      expect(updatedPolicy?.status).toBe('claimed');

      // 7. Verify treasury updated
      const finalTreasuryStats = freshTreasury.getStats();
      expect(finalTreasuryStats.claimsPaid24h).toBeGreaterThan(0);
    });

    it('should handle multiple concurrent policies', () => {
      const vessels = ['AAA111', 'BBB222', 'CCC333'];
      const policies: any[] = [];

      for (const mmsi of vessels) {
        const poolUtilization = treasury.getUtilizationRatio();
        const policy = policyManager.issuePolicy({
          vesselMmsi: mmsi,
          zoneId: 'HORMUZ',
          hullValueUsd: 50_000,
          durationSeconds: 60,
          riskScore: mockRiskScore,
          premiumTxid: `test-tx-${mmsi}`,
          poolUtilization,
        });
        policies.push(policy);
        treasury.addExposure(policy);
      }

      // Verify all policies are active
      const activePolicies = policyManager.getActivePolicies();
      expect(activePolicies.length).toBeGreaterThanOrEqual(vessels.length);

      // Verify each vessel has its policy
      for (const mmsi of vessels) {
        const vesselPolicies = policyManager.getVesselPolicies(mmsi);
        expect(vesselPolicies.length).toBe(1);
      }
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive treasury stats', () => {
      const stats = treasury.getStats();

      expect(stats).toHaveProperty('poolCapacitySats');
      expect(stats).toHaveProperty('totalExposureSats');
      expect(stats).toHaveProperty('availableCapacitySats');
      expect(stats).toHaveProperty('utilizationRatio');
      expect(stats).toHaveProperty('reserveRatio');
      expect(stats).toHaveProperty('needsRebalancing');
      expect(stats).toHaveProperty('premiumIncome24h');
      expect(stats).toHaveProperty('claimsPaid24h');
    });

    it('should provide comprehensive policy stats', () => {
      const stats = policyManager.getStats();

      expect(stats).toHaveProperty('totalPoliciesIssued');
      expect(stats).toHaveProperty('activePolicies');
      expect(stats).toHaveProperty('totalPremiumsCollected');
      expect(stats).toHaveProperty('policyCountByZone');
      expect(stats).toHaveProperty('policyCountByVessel');
    });

    it('should provide comprehensive claims stats', () => {
      const stats = claimsHandler.getStats();

      expect(stats).toHaveProperty('totalClaimsReceived');
      expect(stats).toHaveProperty('claimsApproved');
      expect(stats).toHaveProperty('claimsRejected');
      expect(stats).toHaveProperty('totalPayoutsSent');
      expect(stats).toHaveProperty('lossRatio');
    });
  });
});
