import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import type { DashboardMetrics, Vessel } from '../types';

interface MetricsBarProps {
  metrics: DashboardMetrics;
  vessels: Vessel[];
}

export function MetricsBar({ metrics, vessels }: MetricsBarProps) {
  const chartData = vessels.map((vessel, index) => ({
    idx: index,
    risk: Number((vessel.risk * 100).toFixed(2)),
  }));

  return (
    <header className="metrics-bar">
      <article className="metric-item">
        <span>Total transactions</span>
        <strong>{metrics.totalTxs.toLocaleString()}</strong>
      </article>
      <article className="metric-item">
        <span>Total BSV volume</span>
        <strong>{metrics.totalVolume.toLocaleString()} sats</strong>
      </article>
      <article className="metric-item">
        <span>Active policies</span>
        <strong>{metrics.activePolicies.toLocaleString()}</strong>
      </article>
      <article className="metric-item">
        <span>Claims (filed / settled)</span>
        <strong>
          {metrics.claimsFiled.toLocaleString()} / {metrics.claimsSettled.toLocaleString()}
        </strong>
      </article>
      <article className="metric-item metric-chart">
        <span>Average risk score</span>
        <strong>{(metrics.averageRisk * 100).toFixed(1)}%</strong>
        <div className="sparkline">
          <ResponsiveContainer width="100%" height={35}>
            <AreaChart data={chartData}>
              <Area type="monotone" dataKey="risk" stroke="#f97316" fill="#f9731666" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>
    </header>
  );
}
