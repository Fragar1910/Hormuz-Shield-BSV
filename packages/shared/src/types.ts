/**
 * HormuzShield - Shared Type Definitions
 * Maritime micro-insurance system on BSV blockchain
 */

// ==================== VESSEL & POSITION ====================

export type VesselType = 'VLCC' | 'SUEZMAX' | 'AFRAMAX' | 'LNG';

export interface VesselPosition {
  mmsi: string;
  lat: number;
  lon: number;
  speed: number;           // knots
  course: number;          // degrees 0-360
  heading: number;         // degrees 0-360
  timestamp: number;       // Unix timestamp ms
  vesselType?: VesselType;
  vesselName?: string;
  destination?: string;
  eta?: number;
}

// ==================== RISK ZONES ====================

export interface RiskZone {
  id: string;
  name: string;
  baseThreat: number;      // 0.0–1.0 base risk level
  bbox: [[number, number], [number, number]]; // [[swLat,swLon],[neLat,neLon]]
  awrpRange: [number, number]; // % H&M annual premium range [min, max]
  jwlaListed: boolean;     // Joint War Committee Listed Area
}

// ==================== RISK SCORING ====================

export interface RiskScore {
  vesselMmsi: string;
  timestamp: number;
  zoneId: string;
  baseRisk: number;          // 0.0–1.0 from zone threat level
  proximityRisk: number;     // distance to last known incident
  speedAnomaly: number;      // deviation from expected speed
  courseAnomaly: number;     // deviation from shipping lane
  aggregateRisk: number;     // weighted composite
  confidence: number;        // data freshness factor (0.0–1.0)
  premiumBasisBps: number;   // suggested premium in basis points
}

export interface RiskModifiers {
  recentIncidents24h: number;
  timeOfDay: 'day' | 'night';
  vesselType: VesselType;
  vesselFlag?: string;
  convoyStatus: boolean;
  aisDensity: number;
  geopoliticalEscalation: number; // 0.0–1.0
}

// ==================== INSURANCE POLICY ====================

export interface MicroPolicy {
  policyId: string;           // BSV tx hash
  vesselMmsi: string;
  zoneId: string;
  startTime: number;          // Unix timestamp ms
  durationSeconds: number;    // typically 60s (1-minute policies)
  hullValueUsd: number;
  premiumSats: number;        // calculated from risk score
  coverageSats: number;       // max payout on claim
  riskScoreAtIssuance: number;
  status: 'active' | 'expired' | 'claimed' | 'settled';
  txid?: string;              // on-chain registration tx
}

// ==================== CLAIMS ====================

export interface Claim {
  claimId: string;
  policyId: string;
  vesselMmsi: string;
  incidentTimestamp: number;
  incidentPosition: { lat: number; lon: number };
  incidentType: 'ais_gap' | 'speed_anomaly' | 'course_deviation' | 'proximity_alert' | 'zone_escalation';
  severity: number;           // 0.0–1.0
  evidence: string;
  status: 'pending' | 'approved' | 'rejected' | 'settled';
  verificationScore?: number; // 0.0–1.0
  payoutSats?: number;
  verifiedBy?: string;
  settledTxid?: string;
}

export interface IncidentSignal {
  type: 'ais_gap' | 'speed_anomaly' | 'course_deviation' | 'proximity_alert' | 'zone_escalation';
  severity: number;           // 0.0–1.0
  vesselMmsi: string;
  position: { lat: number; lon: number };
  timestamp: number;
  evidence: string;
}

// ==================== AGENT COMMUNICATIONS ====================

export interface AgentMessage {
  from: string;               // agent identity key
  to: string;
  type: 'risk_query' | 'policy_request' | 'policy_response' | 'claim_filed' | 'claim_verification' | 'claim_response' | 'payment_notification';
  payload: any;
  timestamp: number;
  txid?: string;              // payment tx if applicable
}

export interface RiskDataRequest {
  type: 'risk_query';
  mmsi?: string;
  zoneId?: string;
  timestamp: number;
}

export interface PolicyRequest {
  type: 'policy_request';
  vesselMmsi: string;
  vesselType: VesselType;
  zoneId: string;
  hullValueUsd: number;
  durationSeconds: number;
}

export interface PolicyResponse {
  type: 'policy_response';
  approved: boolean;
  policy?: MicroPolicy;
  rejectionReason?: string;
}

// ==================== WALLET & TRANSACTIONS ====================

export interface AgentWallet {
  agentName: string;
  identityKey: string;
  address: string;
  balanceSats: number;
  txsSent: number;
  txsReceived: number;
}

export interface TransactionRecord {
  txid: string;
  timestamp: number;
  from: string;
  to: string;
  amountSats: number;
  type: string;
  metadata?: any;
}

// ==================== CONFIGURATION ====================

export interface SystemConfig {
  aisApiKey: string;
  bsvNetwork: 'main' | 'test';
  minPremiumSats: number;
  maxPolicyDurationSeconds: number;
  poolCapacitySats: number;
  maxExposureRatio: number;        // max % of pool in single vessel
  verificationThreshold: number;   // min score to approve claim
  batchIntervalMs: number;         // on-chain batch recording interval
}

// ==================== CONSTANTS ====================

export const HULL_VALUES: Record<VesselType, number> = {
  VLCC:    100_000_000, // $100M
  SUEZMAX:  80_000_000, // $80M
  AFRAMAX:  60_000_000, // $60M
  LNG:     200_000_000, // $200M
};

export const TYPE_MULTIPLIER: Record<VesselType, number> = {
  VLCC: 1.5,
  SUEZMAX: 1.3,
  AFRAMAX: 1.0,
  LNG: 2.0,
};

// Approximate BSV/USD rate for demo (1 USD ~ 20,000 sats at BSV = $50)
export const USD_TO_SATS = 20_000;

export const DEFAULT_POLICY_DURATION_SECONDS = 60; // 1 minute
export const DEFAULT_BATCH_INTERVAL_MS = 60_000;   // 1 minute
