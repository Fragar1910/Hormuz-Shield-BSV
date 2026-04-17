/**
 * HormuzShield - Risk Calculator
 * Dynamic risk scoring engine for maritime vessels
 */

import { RiskScore, RiskModifiers, VesselPosition, VesselType, RiskZone } from './types';
import { getZoneForPosition } from './risk-zones';

/**
 * Calculate comprehensive risk score for a vessel
 */
export function calculateRiskScore(
  position: VesselPosition,
  zone: RiskZone | null,
  modifiers?: Partial<RiskModifiers>
): RiskScore {
  const zoneId = zone?.id || 'SAFE';
  const baseRisk = zone?.baseThreat || 0.05;

  // Calculate individual risk factors
  const proximityRisk = calculateProximityRisk(position);
  const speedAnomaly = calculateSpeedAnomaly(position, zone);
  const courseAnomaly = calculateCourseAnomaly(position, zone);

  // Apply modifiers
  const modifierMultiplier = calculateModifierMultiplier(modifiers);

  // Weighted aggregate
  const aggregateRisk = Math.min(1.0,
    (baseRisk * 0.5 +
    proximityRisk * 0.2 +
    speedAnomaly * 0.15 +
    courseAnomaly * 0.15) * modifierMultiplier
  );

  // Calculate confidence based on data freshness
  const confidence = calculateConfidence(position);

  // Convert to basis points for premium calculation
  const premiumBasisBps = Math.round(aggregateRisk * 1000); // 0-1000 bps (0-10%)

  return {
    vesselMmsi: position.mmsi,
    timestamp: Date.now(),
    zoneId,
    baseRisk,
    proximityRisk,
    speedAnomaly,
    courseAnomaly,
    aggregateRisk,
    confidence,
    premiumBasisBps,
  };
}

/**
 * Calculate proximity risk based on distance to known incidents
 * TODO: Implement with actual incident database
 */
function calculateProximityRisk(position: VesselPosition): number {
  // Simplified: assume no incidents nearby for MVP
  // In production, query incident database and calculate nearest distance
  return 0.0;
}

/**
 * Calculate speed anomaly
 * Normal speed for tankers: 12-15 knots
 */
function calculateSpeedAnomaly(position: VesselPosition, zone: RiskZone | null): number {
  const NORMAL_SPEED_MIN = 12;
  const NORMAL_SPEED_MAX = 15;

  if (position.speed >= NORMAL_SPEED_MIN && position.speed <= NORMAL_SPEED_MAX) {
    return 0.0; // Normal speed
  }

  if (position.speed < NORMAL_SPEED_MIN) {
    // Slow speed (potential loitering or distress)
    const slowness = (NORMAL_SPEED_MIN - position.speed) / NORMAL_SPEED_MIN;
    return Math.min(1.0, slowness * 0.5); // Max 0.5 for stopped vessel
  }

  // High speed (unusual for tankers)
  const excess = (position.speed - NORMAL_SPEED_MAX) / NORMAL_SPEED_MAX;
  return Math.min(1.0, excess * 0.3);
}

/**
 * Calculate course anomaly
 * TODO: Implement with shipping lane data
 */
function calculateCourseAnomaly(position: VesselPosition, zone: RiskZone | null): number {
  // Simplified: no lane deviation calculation for MVP
  // In production, calculate deviation from standard shipping lanes
  return 0.0;
}

/**
 * Calculate modifier multiplier from risk modifiers
 */
function calculateModifierMultiplier(modifiers?: Partial<RiskModifiers>): number {
  if (!modifiers) return 1.0;

  let multiplier = 1.0;

  // Time of day
  if (modifiers.timeOfDay === 'night') {
    multiplier *= 1.3;
  }

  // Recent incidents
  if (modifiers.recentIncidents24h) {
    multiplier *= (1 + modifiers.recentIncidents24h * 0.1); // +10% per incident
  }

  // Convoy status (with naval escort)
  if (modifiers.convoyStatus) {
    multiplier *= 0.3; // 70% risk reduction
  }

  // Vessel type
  if (modifiers.vesselType === 'LNG') {
    multiplier *= 2.0; // LNG carriers are high-value targets
  } else if (modifiers.vesselType === 'VLCC') {
    multiplier *= 1.5;
  }

  // Geopolitical escalation
  if (modifiers.geopoliticalEscalation) {
    multiplier *= (1 + modifiers.geopoliticalEscalation);
  }

  // AIS density (high traffic = lower individual risk)
  if (modifiers.aisDensity) {
    const densityFactor = Math.min(1.0, modifiers.aisDensity / 50); // Normalize to 50 vessels
    multiplier *= (1 - densityFactor * 0.2); // Up to -20% in dense areas
  }

  return Math.max(0.1, Math.min(5.0, multiplier)); // Clamp between 0.1x and 5.0x
}

/**
 * Calculate confidence based on data freshness
 */
function calculateConfidence(position: VesselPosition): number {
  const now = Date.now();
  const ageMs = now - position.timestamp;
  const ageMinutes = ageMs / (60 * 1000);

  // Confidence decays with age
  if (ageMinutes < 5) return 1.0;
  if (ageMinutes < 15) return 0.9;
  if (ageMinutes < 30) return 0.7;
  if (ageMinutes < 60) return 0.5;
  return 0.3;
}

/**
 * Get time of day from timestamp
 */
export function getTimeOfDay(timestamp: number = Date.now()): 'day' | 'night' {
  const hour = new Date(timestamp).getUTCHours();
  // Simplified: night = 18:00-06:00 UTC
  return (hour >= 18 || hour < 6) ? 'night' : 'day';
}

/**
 * Auto-calculate risk score with zone detection
 */
export function autoCalculateRisk(
  position: VesselPosition,
  modifiers?: Partial<RiskModifiers>
): RiskScore {
  const zone = getZoneForPosition(position.lat, position.lon);
  return calculateRiskScore(position, zone, modifiers);
}
