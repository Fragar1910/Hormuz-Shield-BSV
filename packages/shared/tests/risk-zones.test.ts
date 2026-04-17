/**
 * Tests for risk-zones module
 */

import { describe, it, expect } from 'vitest';
import {
  RISK_ZONES,
  getZoneForPosition,
  getZoneById,
  isInRiskZone,
  getJWLAZones,
  calculateDistance,
} from '../src/risk-zones';

describe('Risk Zones', () => {
  it('should have 7 risk zones defined', () => {
    expect(RISK_ZONES).toHaveLength(7);
  });

  it('should have all required zone properties', () => {
    RISK_ZONES.forEach(zone => {
      expect(zone).toHaveProperty('id');
      expect(zone).toHaveProperty('name');
      expect(zone).toHaveProperty('baseThreat');
      expect(zone).toHaveProperty('bbox');
      expect(zone).toHaveProperty('awrpRange');
      expect(zone).toHaveProperty('jwlaListed');
    });
  });

  it('should detect position in Strait of Hormuz', () => {
    const hormuzPosition = { lat: 26.0, lon: 56.5 };
    const zone = getZoneForPosition(hormuzPosition.lat, hormuzPosition.lon);

    expect(zone).not.toBeNull();
    expect(zone?.id).toBe('HORMUZ');
    expect(zone?.baseThreat).toBe(0.90);
  });

  it('should detect position in Persian Gulf', () => {
    const persianGulfPosition = { lat: 27.0, lon: 52.0 };
    const zone = getZoneForPosition(persianGulfPosition.lat, persianGulfPosition.lon);

    expect(zone).not.toBeNull();
    expect(zone?.id).toBe('PERSIAN');
  });

  it('should return null for position outside risk zones', () => {
    // Position in open Atlantic Ocean
    const safePosition = { lat: 30.0, lon: -30.0 };
    const zone = getZoneForPosition(safePosition.lat, safePosition.lon);

    expect(zone).toBeNull();
  });

  it('should get zone by ID', () => {
    const zone = getZoneById('HORMUZ');

    expect(zone).not.toBeUndefined();
    expect(zone?.name).toBe('Strait of Hormuz');
  });

  it('should return undefined for invalid zone ID', () => {
    const zone = getZoneById('INVALID_ZONE');

    expect(zone).toBeUndefined();
  });

  it('should identify if position is in any risk zone', () => {
    const hormuzPosition = { lat: 26.0, lon: 56.5 };
    const safePosition = { lat: 30.0, lon: -30.0 };

    expect(isInRiskZone(hormuzPosition.lat, hormuzPosition.lon)).toBe(true);
    expect(isInRiskZone(safePosition.lat, safePosition.lon)).toBe(false);
  });

  it('should filter JWLA-listed zones', () => {
    const jwlaZones = getJWLAZones();

    expect(jwlaZones.length).toBeGreaterThan(0);
    jwlaZones.forEach(zone => {
      expect(zone.jwlaListed).toBe(true);
    });
  });

  it('should calculate distance between two points', () => {
    // Distance from Dubai (25.2048, 55.2708) to Abu Dhabi (24.4539, 54.3773)
    const distance = calculateDistance(25.2048, 55.2708, 24.4539, 54.3773);

    // Expected distance: ~66 nautical miles (verified)
    expect(distance).toBeGreaterThan(60);
    expect(distance).toBeLessThan(70);
  });

  it('should calculate zero distance for same point', () => {
    const distance = calculateDistance(26.0, 56.0, 26.0, 56.0);

    expect(distance).toBe(0);
  });

  it('should have valid AWRP ranges', () => {
    RISK_ZONES.forEach(zone => {
      expect(zone.awrpRange).toHaveLength(2);
      expect(zone.awrpRange[0]).toBeLessThanOrEqual(zone.awrpRange[1]);
      expect(zone.awrpRange[0]).toBeGreaterThanOrEqual(0);
    });
  });

  it('should have valid base threat levels', () => {
    RISK_ZONES.forEach(zone => {
      expect(zone.baseThreat).toBeGreaterThanOrEqual(0);
      expect(zone.baseThreat).toBeLessThanOrEqual(1);
    });
  });

  it('should have Hormuz as highest threat zone', () => {
    const hormuz = getZoneById('HORMUZ');
    const otherZones = RISK_ZONES.filter(z => z.id !== 'HORMUZ');

    expect(hormuz).not.toBeUndefined();
    otherZones.forEach(zone => {
      expect(hormuz!.baseThreat).toBeGreaterThanOrEqual(zone.baseThreat);
    });
  });
});
