import { useEffect, useMemo, useState } from 'react';
import type { Agent, DashboardMetrics, TxEvent, Vessel } from '../types';

const DEMO_AGENTS: Agent[] = [
  { name: 'Shipowner Agent', balance: 620_000, txsSent: 122, txsReceived: 7, activePolicies: 13 },
  { name: 'Risk Oracle', balance: 310_000, txsSent: 210, txsReceived: 211, activePolicies: 0 },
  { name: 'Insurer Pool', balance: 2_940_000, txsSent: 26, txsReceived: 147, activePolicies: 58 },
  { name: 'Claims Verifier', balance: 470_000, txsSent: 79, txsReceived: 91, activePolicies: 2 },
];

// Generate 50 demo vessels for initial display
const DEMO_VESSELS: Vessel[] = Array.from({ length: 50 }, (_, i) => {
  const routes = [
    { lat: 26.0 + Math.random() * 1.5, lon: 55.5 + Math.random() * 2.5 }, // Hormuz
    { lat: 24.5 + Math.random() * 2.0, lon: 52.0 + Math.random() * 3.0 }, // Persian Gulf
    { lat: 12.5 + Math.random() * 1.5, lon: 43.0 + Math.random() * 2.0 }, // Bab el-Mandeb
  ];
  const route = routes[i % routes.length];
  const types = ['VLCC Tanker', 'LNG Carrier', 'Container Ship', 'Bulk Carrier'];

  return {
    mmsi: (300000000 + i).toString(),
    lat: route.lat,
    lon: route.lon,
    risk: 0.3 + Math.random() * 0.6,
    type: types[i % types.length],
  };
});

function nextTx(existingCount: number): TxEvent {
  const amount = 600 + Math.floor(Math.random() * 5_000);
  const type = Math.random() > 0.85 ? 'claim' : 'premium';
  const from = type === 'claim' ? 'Insurer Pool' : 'Shipowner Agent';
  const to = type === 'claim' ? 'Shipowner Agent' : 'Insurer Pool';
  return {
    id: `demo-${existingCount}-${Date.now()}`,
    type,
    amount,
    from,
    to,
    timestamp: Date.now(),
    txid: `demo_tx_${Date.now().toString(36)}`,
  };
}

const DEFAULT_METRICS: DashboardMetrics = {
  totalTxs: 0,
  totalVolume: 0,
  activePolicies: 0,
  averageRisk: 0,
  claimsFiled: 0,
  claimsSettled: 0,
};

export function useAgentSocket(wsUrl = 'ws://localhost:3103') { // Shipowner WebSocket port (3003 + 100)
  const [vessels, setVessels] = useState<Vessel[]>(DEMO_VESSELS);
  const [agents, setAgents] = useState<Agent[]>(DEMO_AGENTS);
  const [transactions, setTransactions] = useState<TxEvent[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const fallbackTimer = setInterval(() => {
      if (isConnected) return;
      setTransactions((prev) => {
        const tx = nextTx(prev.length);
        const next = [tx, ...prev].slice(0, 60);
        return next;
      });
      setVessels((prev) =>
        prev.map((vessel) => ({
          ...vessel,
          risk: Math.max(0.1, Math.min(0.99, vessel.risk + (Math.random() - 0.5) * 0.1)),
        })),
      );
    }, 2200);

    return () => clearInterval(fallbackTimer);
  }, [isConnected]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let mounted = true;

    // Connect with small delay to avoid React Strict Mode double-mount issues
    const connect = () => {
      if (!mounted) return;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (mounted) {
          console.log('[WebSocket] Connected to', wsUrl);
          setIsConnected(true);
        }
      };

      ws.onclose = () => {
        if (mounted) {
          console.log('[WebSocket] Disconnected from', wsUrl);
          setIsConnected(false);
        }
      };

      ws.onerror = (error) => {
        if (mounted) {
          console.error('[WebSocket] Connection error:', error);
          setIsConnected(false);
        }
      };

      ws.onmessage = (event) => {
        if (!mounted) return;

        try {
          const message = JSON.parse(event.data);

          if (message.type === 'vessels') {
            setVessels(message.data as Vessel[]);
          } else if (message.type === 'agents') {
            setAgents(message.data as Agent[]);
          } else if (message.type === 'txCount') {
            setMetrics((prev) => ({ ...prev, totalTxs: Number(message.count || 0) }));
          } else if (message.type === 'tx') {
            setTransactions((prev) => [message.data as TxEvent, ...prev].slice(0, 100));
          } else if (message.type === 'transactions') {
            setTransactions((message.data as TxEvent[]).slice(0, 100));
          } else if (message.type === 'metrics') {
            setMetrics((prev) => ({ ...prev, ...(message.data as Partial<DashboardMetrics>) }));
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
    };

    // Connect after a small delay
    const connectTimer = setTimeout(connect, 100);

    return () => {
      mounted = false;
      clearTimeout(connectTimer);

      // Only close if WebSocket was actually opened
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [wsUrl]);

  const computedMetrics = useMemo<DashboardMetrics>(() => {
    const totalVolume = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const averageRisk =
      vessels.length === 0 ? 0 : vessels.reduce((sum, vessel) => sum + vessel.risk, 0) / vessels.length;
    const activePolicies = agents.reduce((sum, agent) => sum + agent.activePolicies, 0);
    const claimsFiled = transactions.filter((tx) => tx.type === 'claim').length;

    return {
      totalTxs: metrics.totalTxs || transactions.length,
      totalVolume: metrics.totalVolume || totalVolume,
      activePolicies: metrics.activePolicies || activePolicies,
      averageRisk: metrics.averageRisk || averageRisk,
      claimsFiled: metrics.claimsFiled || claimsFiled,
      claimsSettled: metrics.claimsSettled || Math.floor(claimsFiled * 0.72),
    };
  }, [agents, metrics, transactions, vessels]);

  return {
    vessels,
    agents,
    transactions,
    metrics: computedMetrics,
    isConnected,
  };
}
