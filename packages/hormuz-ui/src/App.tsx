import 'leaflet/dist/leaflet.css';
import './App.css';
import { AgentPanel } from './components/AgentPanel';
import { MapView } from './components/MapView';
import { MetricsBar } from './components/MetricsBar';
import { TxFeed } from './components/TxFeed';
import { useAgentSocket } from './hooks/useAgentSocket';

function App() {
  const { agents, isConnected, metrics, transactions, vessels } = useAgentSocket();

  return (
    <main className="dashboard">
      <MetricsBar metrics={metrics} vessels={vessels} />

      <section className="content-grid">
        <section className="map-panel">
          <div className="connection-pill">{isConnected ? 'Connected' : 'Demo mode (WS offline)'}</div>
          <MapView vessels={vessels} transactions={transactions} />
        </section>
        <AgentPanel agents={agents} />
      </section>

      <TxFeed transactions={transactions} />
    </main>
  );
}

export default App;
