/**
 * Tests for risk-calculator module
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRiskScore,
  autoCalculateRisk,
  getTimeOfDay,
} from '../src/risk-calculator';
import type { VesselPosition, RiskZone } from '../src/types';
import { getZoneById } from '../src/risk-zones';

describe('Risk Calculator', () => {
  const mockVessel: VesselPosition = {
    mmsi: '368207620',
    lat: 26.0,
    lon: 56.5,
    speed: 13.5,
    course: 45,
    heading: 45,
    timestamp: Date.now(),
    vesselName: 'Test Tanker',
  };

  it('should calculate risk score with zone', () => {
    const zone = getZoneById('HORMUZ')!;
    const riskScore = calculateRiskScore(mockVessel, zone);

    expect(riskScore).toHaveProperty('vesselMmsi', mockVessel.mmsi);
    expect(riskScore).toHaveProperty('zoneId', 'HORMUZ');
    expect(riskScore).toHaveProperty('baseRisk');
    expect(riskScore).toHaveProperty('aggregateRisk');
    expect(riskScore).toHaveProperty('confidence');
    expect(riskScore).toHaveProperty('premiumBasisBps');
  });

  it('should calculate risk score without zone (safe waters)', () => {
    const riskScore = calculateRiskScore(mockVessel, null);

    expect(riskScore.zoneId).toBe('SAFE');
    expect(riskScore.baseRisk).toBe(0.05);
  });

  it('should have aggregate risk between 0 and 1', () => {
    const zone = getZoneById('HORMUZ')!;
    const riskScore = calculateRiskScore(mockVessel, zone);

    expect(riskScore.aggregateRisk).toBeGreaterThanOrEqual(0);
    expect(riskScore.aggregateRisk).toBeLessThanOrEqual(1);
  });

  it('should have confidence between 0 and 1', () => {
    const zone = getZoneById('HORMUZ')!;
    const riskScore = calculateRiskScore(mockVessel, zone);

    expect(riskScore.confidence).toBeGreaterThanOrEqual(0);
    expect(riskScore.confidence).toBeLessThanOrEqual(1);
  });

  it('should calculate speed anomaly for slow vessel', () => {
    const slowVessel: VesselPosition = {
      ...mockVessel,
      speed: 5.0, // Below normal (12-15 knots)
    };

    const zone = getZoneById('HORMUZ')!;
    const riskScore = calculateRiskScore(slowVessel, zone);

    expect(riskScore.speedAnomaly).toBeGreaterThan(0);
  });

  it('should calculate no speed anomaly for normal speed', () => {
    const normalVessel: VesselPosition = {
      ...mockVessel,
      speed: 13.5, // Normal speed
    };

    const zone = getZoneById('HORMUZ')!;
    const riskScore = calculateRiskScore(normalVessel, zone);

    expect(riskScore.speedAnomaly).toBe(0);
  });

  it('should auto-calculate risk with zone detection', () => {
    const hormuzVessel: VesselPosition = {
      ...mockVessel,
      lat: 26.0,
      lon: 56.5, // Inside Hormuz
    };

    const riskScore = autoCalculateRisk(hormuzVessel);

    expect(riskScore.zoneId).toBe('HORMUZ');
    expect(riskScore.baseRisk).toBe(0.90);
  });

  it('should auto-calculate risk for safe waters', () => {
    const safeVessel: VesselPosition = {
      ...mockVessel,
      lat: 30.0,
      lon: -30.0, // Outside any risk zone (Atlantic Ocean)
    };

    const riskScore = autoCalculateRisk(safeVessel);

    expect(riskScore.zoneId).toBe('SAFE');
    expect(riskScore.baseRisk).toBe(0.05);
  });

  it('should calculate higher risk for high-threat zones', () => {
    const hormuzZone = getZoneById('HORMUZ')!;
    const guineaZone = getZoneById('GUINEA')!;

    const hormuzScore = calculateRiskScore(mockVessel, hormuzZone);
    const guineaScore = calculateRiskScore(mockVessel, guineaZone);

    expect(hormuzScore.baseRisk).toBeGreaterThan(guineaScore.baseRisk);
  });

  it('should calculate premium basis points', () => {
    const zone = getZoneById('HORMUZ')!;
    const riskScore = calculateRiskScore(mockVessel, zone);

    expect(riskScore.premiumBasisBps).toBeGreaterThan(0);
    expect(riskScore.premiumBasisBps).toBeLessThanOrEqual(1000);
  });

  it('should reduce confidence for old data', () => {
    const oldVessel: VesselPosition = {
      ...mockVessel,
      timestamp: Date.now() - 60 * 60 * 1000, // 1 hour old
    };

    const zone = getZoneById('HORMUZ')!;
    const riskScore = calculateRiskScore(oldVessel, zone);

    expect(riskScore.confidence).toBeLessThan(1.0);
  });

  it('should have high confidence for fresh data', () => {
    const freshVessel: VesselPosition = {
      ...mockVessel,
      timestamp: Date.now() - 1000, // 1 second old
    };

    const zone = getZoneById('HORMUZ')!;
    const riskScore = calculateRiskScore(freshVessel, zone);

    expect(riskScore.confidence).toBe(1.0);
  });

  it('should detect day time correctly', () => {
    const dayTime = new Date('2026-04-12T12:00:00Z').getTime();
    expect(getTimeOfDay(dayTime)).toBe('day');
  });

  it('should detect night time correctly', () => {
    const nightTime = new Date('2026-04-12T02:00:00Z').getTime();
    expect(getTimeOfDay(nightTime)).toBe('night');
  });

  it('should apply modifiers correctly', () => {
    const zone = getZoneById('HORMUZ')!;

    const baseScore = calculateRiskScore(mockVessel, zone);

    const nightScore = calculateRiskScore(mockVessel, zone, {
      timeOfDay: 'night',
    });

    // Night should increase risk
    expect(nightScore.aggregateRisk).toBeGreaterThan(baseScore.aggregateRisk);
  });

  it('should reduce risk with convoy status', () => {
    const zone = getZoneById('HORMUZ')!;

    const baseScore = calculateRiskScore(mockVessel, zone);

    const convoyScore = calculateRiskScore(mockVessel, zone, {
      convoyStatus: true,
    });

    // Convoy should reduce risk
    expect(convoyScore.aggregateRisk).toBeLessThan(baseScore.aggregateRisk);
  });
});
