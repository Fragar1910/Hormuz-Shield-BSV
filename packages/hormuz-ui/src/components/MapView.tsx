import { CircleMarker, MapContainer, Polyline, Popup, Rectangle, TileLayer, Tooltip } from 'react-leaflet';
import { RISK_ZONES } from '../risk-zones';
import type { TxEvent, Vessel } from '../types';

interface MapViewProps {
  vessels: Vessel[];
  transactions: TxEvent[];
}

const AGENT_COORDS: Record<string, [number, number]> = {
  'Shipowner Agent': [25.28, 55.3],
  'Risk Oracle': [24.45, 54.38],
  'Insurer Pool': [26.23, 50.58],
  'Claims Verifier': [23.58, 58.4],
};

function riskColor(risk: number): string {
  if (risk > 0.7) return '#E24B4A';
  if (risk > 0.4) return '#EF9F27';
  return '#5DCAA5';
}

export function MapView({ vessels, transactions }: MapViewProps) {
  const recentTransfers = transactions.slice(0, 12);

  return (
    <MapContainer center={[25.4, 56]} zoom={5} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {RISK_ZONES.map((zone) => (
        <Rectangle
          key={zone.id}
          bounds={zone.bbox}
          pathOptions={{
            color: zone.baseThreat > 0.8 ? '#E24B4A' : zone.baseThreat > 0.6 ? '#EF9F27' : '#FAC775',
            fillOpacity: 0.15,
            weight: 1,
          }}
        >
          <Tooltip>
            {zone.name} - AWRP {zone.awrpRange[0]}-{zone.awrpRange[1]}%
          </Tooltip>
        </Rectangle>
      ))}

      {vessels.map((vessel) => (
        <CircleMarker
          key={vessel.mmsi}
          center={[vessel.lat, vessel.lon]}
          radius={6}
          pathOptions={{ color: riskColor(vessel.risk), fillOpacity: 0.85 }}
        >
          <Popup>
            MMSI {vessel.mmsi}
            <br />
            Risk: {vessel.risk.toFixed(2)}
            <br />
            {vessel.type}
          </Popup>
        </CircleMarker>
      ))}

      {recentTransfers.map((tx) => {
        const from = AGENT_COORDS[tx.from];
        const to = AGENT_COORDS[tx.to];
        if (!from || !to) return null;
        return (
          <Polyline
            key={tx.id}
            positions={[from, to]}
            pathOptions={{ color: tx.type === 'claim' ? '#5b7fff' : '#7a5cff', weight: 2, opacity: 0.65 }}
          >
            <Tooltip>
              {tx.type.toUpperCase()} {tx.amount.toLocaleString()} sats
            </Tooltip>
          </Polyline>
        );
      })}
    </MapContainer>
  );
}
