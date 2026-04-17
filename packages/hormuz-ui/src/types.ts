export interface Vessel {
  mmsi: string;
  lat: number;
  lon: number;
  risk: number;
  type: string;
}

export interface Agent {
  name: string;
  balance: number;
  txsSent: number;
  txsReceived: number;
  activePolicies: number;
}

export interface TxEvent {
  id: string;
  type: string;
  amount: number;
  from: string;
  to: string;
  timestamp: number;
  txid?: string;
}

export interface DashboardMetrics {
  totalTxs: number;
  totalVolume: number;
  activePolicies: number;
  averageRisk: number;
  claimsFiled: number;
  claimsSettled: number;
}
