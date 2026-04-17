/**
 * Risk Oracle - Integration Tests
 * Tests the complete payment flow without real blockchain transactions
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { AgentWallet } from '../wallet';
import { DirectPaymentManager } from '../payments';
import { RiskEngine } from '../risk-engine';
import { PrivateKey } from '@bsv/sdk';

describe('Risk Oracle Integration Tests', () => {
  let wallet: AgentWallet;
  let paymentManager: DirectPaymentManager;
  let riskEngine: RiskEngine;

  beforeAll(() => {
    // Create test wallet
    const testKey = PrivateKey.fromRandom();
    wallet = new AgentWallet({
      privateKeyWif: testKey.toWif(),
      network: 'test',
    });

    // Initialize components
    paymentManager = new DirectPaymentManager(testKey);
    riskEngine = new RiskEngine(wallet);
  });

  describe('Payment Flow', () => {
    it('should create payment request', () => {
      const request = paymentManager.createPaymentRequest(1, 'risk_score', { mmsi: '368207620' });

      expect(request.serverIdentityKey).toBe(wallet.getIdentityKey());
      expect(request.derivationPrefix).toBeDefined();
      expect(request.derivationSuffix).toBeDefined();
      expect(request.satoshis).toBe(1);
    });

    it('should register payment handlers', () => {
      let handlerCalled = false;

      paymentManager.registerPaymentHandler('test_request', async (payment, metadata) => {
        handlerCalled = true;
        return { success: true, data: metadata };
      });

      expect(handlerCalled).toBe(false);

      const stats = paymentManager.getStats();
      expect(stats.totalHandlers).toBeGreaterThan(0);
      expect(stats.handlers).toContain('test_request');
    });

    it('should process payment with handler', async () => {
      // Register handler
      paymentManager.registerPaymentHandler('risk_score', async (payment, metadata) => {
        const mmsi = metadata.mmsi;
        return {
          success: true,
          data: {
            vesselMmsi: mmsi,
            aggregateRisk: 0.5,
            zoneId: 'TEST_ZONE',
          },
        };
      });

      // Simulate incoming payment
      const mockPayment = {
        tx: new Uint8Array([1, 2, 3]),
        senderIdentityKey: wallet.getIdentityKey(),
        derivationPrefix: 'test',
        derivationSuffix: 'test',
        outputIndex: 0,
        requestType: 'risk_score',
        metadata: { mmsi: '368207620' },
      };

      const response = await paymentManager.processPayment(mockPayment);

      expect(response.success).toBe(true);
      expect(response.data.vesselMmsi).toBe('368207620');
    });
  });

  describe('Risk Engine', () => {
    it('should calculate risk for vessel position', () => {
      const position = {
        mmsi: '368207620',
        lat: 26.0,
        lon: 56.5,
        speed: 12.5,
        course: 180,
        heading: 180,
        timestamp: Date.now(),
      };

      const riskScore = riskEngine.calculateRisk(position);

      expect(riskScore.vesselMmsi).toBe('368207620');
      expect(riskScore.zoneId).toBe('HORMUZ');
      expect(riskScore.aggregateRisk).toBeGreaterThan(0);
      expect(riskScore.baseRisk).toBeDefined();
    });

    it('should retrieve stored risk score', () => {
      const position = {
        mmsi: '123456789',
        lat: 26.0,
        lon: 56.5,
        speed: 10,
        course: 90,
        heading: 90,
        timestamp: Date.now(),
      };

      // Calculate and store
      riskEngine.calculateRisk(position);

      // Retrieve
      const stored = riskEngine.getRiskScore('123456789');
      expect(stored).toBeDefined();
      expect(stored?.vesselMmsi).toBe('123456789');
    });

    it('should get zone status', () => {
      // Add some vessels to the zone
      const position1 = {
        mmsi: '111111111',
        lat: 26.0,
        lon: 56.5,
        speed: 10,
        course: 90,
        heading: 90,
        timestamp: Date.now(),
      };

      const position2 = {
        mmsi: '222222222',
        lat: 26.2,
        lon: 56.6,
        speed: 15,
        course: 180,
        heading: 180,
        timestamp: Date.now(),
      };

      riskEngine.calculateRisk(position1);
      riskEngine.calculateRisk(position2);

      const zoneStatus = riskEngine.getZoneStatus('HORMUZ');

      expect(zoneStatus.zoneId).toBe('HORMUZ');
      expect(zoneStatus.vesselCount).toBeGreaterThanOrEqual(2);
      expect(zoneStatus.averageRisk).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Flow', () => {
    it('should complete full request-pay-response cycle', async () => {
      // 1. Client requests payment info
      const paymentRequest = paymentManager.createPaymentRequest(
        1,
        'risk_score',
        { mmsi: '368207620' }
      );

      expect(paymentRequest.satoshis).toBe(1);

      // 2. Client creates payment (mocked)
      const mockPayment = await wallet.sendDirectPayment(paymentRequest);

      expect(mockPayment.txid).toBeDefined();
      expect(mockPayment.senderIdentityKey).toBe(wallet.getIdentityKey());

      // 3. Add vessel data to risk engine
      const position = {
        mmsi: '368207620',
        lat: 26.0,
        lon: 56.5,
        speed: 12.5,
        course: 180,
        heading: 180,
        timestamp: Date.now(),
      };
      riskEngine.calculateRisk(position);

      // 4. Register handler that returns real data
      paymentManager.registerPaymentHandler('risk_score', async (payment, metadata) => {
        const mmsi = metadata.mmsi;
        const riskScore = riskEngine.getRiskScore(mmsi);

        if (!riskScore) {
          return { error: 'Risk score not found', mmsi };
        }

        return {
          success: true,
          data: riskScore,
        };
      });

      // 5. Process payment
      const incomingPayment = {
        tx: mockPayment.tx,
        senderIdentityKey: mockPayment.senderIdentityKey,
        derivationPrefix: mockPayment.derivationPrefix,
        derivationSuffix: mockPayment.derivationSuffix,
        outputIndex: mockPayment.outputIndex,
        requestType: 'risk_score',
        metadata: { mmsi: '368207620' },
      };

      const response = await paymentManager.processPayment(incomingPayment);

      // 6. Verify response
      expect(response.success).toBe(true);
      expect(response.data.vesselMmsi).toBe('368207620');
      expect(response.data.zoneId).toBe('HORMUZ');
      expect(response.data.aggregateRisk).toBeGreaterThan(0);

      // 7. Oracle internalizes payment (mocked)
      await wallet.receiveDirectPayment(incomingPayment);
    });
  });

  describe('Statistics', () => {
    it('should track payment handler stats', () => {
      const stats = paymentManager.getStats();

      expect(stats.totalHandlers).toBeGreaterThan(0);
      expect(stats.handlers).toBeInstanceOf(Array);
    });

    it('should track risk engine stats', () => {
      const stats = riskEngine.getStats();

      expect(stats.totalVessels).toBeGreaterThan(0);
      expect(stats.bufferedEvents).toBeGreaterThanOrEqual(0);
    });
  });
});
