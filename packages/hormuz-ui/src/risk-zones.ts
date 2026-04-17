export interface RiskZone {
  id: string;
  name: string;
  baseThreat: number;
  bbox: [[number, number], [number, number]];
  awrpRange: [number, number];
}

export const RISK_ZONES: RiskZone[] = [
  { id: 'HORMUZ', name: 'Strait of Hormuz', baseThreat: 0.9, bbox: [[25.5, 56.0], [27.0, 57.5]], awrpRange: [1.0, 5.0] },
  { id: 'PERSIAN', name: 'Persian Gulf', baseThreat: 0.8, bbox: [[24.0, 49.0], [30.5, 56.0]], awrpRange: [0.5, 3.0] },
  { id: 'OMAN', name: 'Gulf of Oman', baseThreat: 0.7, bbox: [[22.5, 57.0], [26.5, 66.0]], awrpRange: [0.25, 1.5] },
  { id: 'BAB', name: 'Bab el-Mandeb', baseThreat: 0.75, bbox: [[12.0, 42.5], [13.5, 44.5]], awrpRange: [0.5, 3.0] },
  { id: 'RED_SEA', name: 'Southern Red Sea', baseThreat: 0.65, bbox: [[12.0, 38.0], [20.0, 44.0]], awrpRange: [0.25, 2.0] },
  { id: 'BLACK_SEA', name: 'Black Sea', baseThreat: 0.6, bbox: [[41.0, 28.0], [47.0, 42.0]], awrpRange: [0.5, 2.0] },
  { id: 'GUINEA', name: 'Gulf of Guinea', baseThreat: 0.4, bbox: [[0.0, -5.0], [8.0, 10.0]], awrpRange: [0.1, 0.5] },
];
