/**
 * Tests for utils module
 */

import { describe, it, expect } from 'vitest';
import {
  satsToBsv,
  satsToUsd,
  usdToSats,
  formatTimestamp,
  generateId,
  sleep,
  clamp,
  percentage,
  formatNumber,
  truncate,
  inRange,
  isValidTxid,
  isValidMmsi,
  generateMmsi,
  knotsToKmh,
  kmhToKnots,
  calculateBearing,
} from '../src/utils';

describe('Utils', () => {
  describe('Currency conversions', () => {
    it('should convert satoshis to BSV', () => {
      expect(satsToBsv(100_000_000)).toBe('1.00000000');
      expect(satsToBsv(50_000_000)).toBe('0.50000000');
      expect(satsToBsv(1)).toBe('0.00000001');
    });

    it('should convert satoshis to USD', () => {
      const usd = satsToUsd(100_000_000, 50); // 1 BSV at $50
      expect(parseFloat(usd)).toBe(50);
    });

    it('should convert USD to satoshis', () => {
      const sats = usdToSats(50, 50); // $50 at BSV=$50
      expect(sats).toBe(100_000_000);
    });
  });

  describe('Timestamp formatting', () => {
    it('should format timestamp to ISO string', () => {
      const timestamp = new Date('2026-04-12T12:00:00.000Z').getTime();
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toBe('2026-04-12T12:00:00.000Z');
    });
  });

  describe('ID generation', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with prefix', () => {
      const id = generateId('TEST');
      expect(id).toMatch(/^TEST_/);
    });
  });

  describe('Sleep utility', () => {
    it('should sleep for specified milliseconds', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance
    });
  });

  describe('Math utilities', () => {
    it('should clamp value between min and max', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should calculate percentage', () => {
      expect(percentage(50, 100)).toBe(50);
      expect(percentage(25, 100)).toBe(25);
      expect(percentage(0, 100)).toBe(0);
    });

    it('should handle percentage with zero total', () => {
      expect(percentage(50, 0)).toBe(0);
    });

    it('should check if value is in range', () => {
      expect(inRange(5, 0, 10)).toBe(true);
      expect(inRange(0, 0, 10)).toBe(true);
      expect(inRange(10, 0, 10)).toBe(true);
      expect(inRange(-1, 0, 10)).toBe(false);
      expect(inRange(11, 0, 10)).toBe(false);
    });
  });

  describe('String utilities', () => {
    it('should format number with thousands separator', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should truncate string to max length', () => {
      expect(truncate('Hello World', 5)).toBe('He...');
      expect(truncate('Hi', 10)).toBe('Hi');
    });
  });

  describe('Validation utilities', () => {
    it('should validate BSV transaction ID', () => {
      const validTxid = 'a'.repeat(64);
      const invalidTxid = 'invalid';

      expect(isValidTxid(validTxid)).toBe(true);
      expect(isValidTxid(invalidTxid)).toBe(false);
    });

    it('should validate MMSI', () => {
      expect(isValidMmsi('368207620')).toBe(true);
      expect(isValidMmsi('12345')).toBe(false);
      expect(isValidMmsi('abcdefghi')).toBe(false);
    });

    it('should generate valid MMSI', () => {
      const mmsi = generateMmsi();
      expect(isValidMmsi(mmsi)).toBe(true);
      expect(mmsi).toHaveLength(9);
    });
  });

  describe('Maritime utilities', () => {
    it('should convert knots to km/h', () => {
      expect(knotsToKmh(10)).toBeCloseTo(18.52, 1);
    });

    it('should convert km/h to knots', () => {
      expect(kmhToKnots(18.52)).toBeCloseTo(10, 1);
    });

    it('should calculate bearing between two points', () => {
      // North from (0,0) to (1,0)
      const northBearing = calculateBearing(0, 0, 1, 0);
      expect(northBearing).toBeCloseTo(0, 0);

      // East from (0,0) to (0,1)
      const eastBearing = calculateBearing(0, 0, 0, 1);
      expect(eastBearing).toBeCloseTo(90, 0);
    });
  });
});
