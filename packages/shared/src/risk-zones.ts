/**
 * HormuzShield - Risk Zone Definitions
 * Based on Joint War Listed Areas (JWLA) and real maritime risk data
 */

import { RiskZone } from './types';

/**
 * 7 maritime risk zones based on current geopolitical situation (April 2026)
 */
export const RISK_ZONES: RiskZone[] = [
  {
    id: 'HORMUZ',
    name: 'Strait of Hormuz',
    baseThreat: 0.90,
    bbox: [[25.5, 56.0], [27.0, 57.5]],
    awrpRange: [1.0, 5.0],  // 1-5% H&M annual war risk premium
    jwlaListed: true,
  },
  {
    id: 'PERSIAN',
    name: 'Persian Gulf',
    baseThreat: 0.80,
    bbox: [[24.0, 49.0], [30.5, 56.0]],
    awrpRange: [0.5, 3.0],
    jwlaListed: true,
  },
  {
    id: 'OMAN',
    name: 'Gulf of Oman',
    baseThreat: 0.70,
    bbox: [[22.5, 57.0], [26.5, 66.0]],
    awrpRange: [0.25, 1.5],
    jwlaListed: true,
  },
  {
    id: 'BAB',
    name: 'Bab el-Mandeb',
    baseThreat: 0.75,
    bbox: [[12.0, 42.5], [13.5, 44.5]],
    awrpRange: [0.5, 3.0],
    jwlaListed: true,
  },
  {
    id: 'RED_SEA',
    name: 'Southern Red Sea',
    baseThreat: 0.65,
    bbox: [[12.0, 38.0], [20.0, 44.0]],
    awrpRange: [0.25, 2.0],
    jwlaListed: true,
  },
  {
    id: 'BLACK_SEA',
    name: 'Black Sea',
    baseThreat: 0.60,
    bbox: [[41.0, 28.0], [47.0, 42.0]],
    awrpRange: [0.5, 2.0],
    jwlaListed: true,
  },
  {
    id: 'GUINEA',
    name: 'Gulf of Guinea',
    baseThreat: 0.40,
    bbox: [[0.0, -5.0], [8.0, 10.0]],
    awrpRange: [0.1, 0.5],
    jwlaListed: false,
  },
];

/**
 * Get risk zone for a given position
 */
export function getZoneForPosition(lat: number, lon: number): RiskZone | null {
  for (const zone of RISK_ZONES) {
    const [[s, w], [n, e]] = zone.bbox;
    if (lat >= s && lat <= n && lon >= w && lon <= e) {
      return zone;
    }
  }
  return null;
}

/**
 * Get zone by ID
 */
export function getZoneById(zoneId: string): RiskZone | undefined {
  return RISK_ZONES.find(z => z.id === zoneId);
}

/**
 * Check if position is in any risk zone
 */
export function isInRiskZone(lat: number, lon: number): boolean {
  return getZoneForPosition(lat, lon) !== null;
}

/**
 * Get all JWLA-listed zones
 */
export function getJWLAZones(): RiskZone[] {
  return RISK_ZONES.filter(z => z.jwlaListed);
}

/**
 * Calculate distance between two points (Haversine formula)
 * Returns distance in nautical miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * BoundingBox configurations for AIS Stream filtering
 */
export const AIS_BOUNDING_BOXES = RISK_ZONES.map(zone => ({
  zoneId: zone.id,
  name: zone.name,
  boundingBox: zone.bbox,
}));
