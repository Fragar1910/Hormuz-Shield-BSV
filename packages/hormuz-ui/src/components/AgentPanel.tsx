import type { Agent } from '../types';

interface AgentPanelProps {
  agents: Agent[];
}

export function AgentPanel({ agents }: AgentPanelProps) {
  return (
    <aside className="agent-panel">
      <h2>Agents</h2>
      <div className="agent-list">
        {agents.map((agent) => (
          <article key={agent.name} className="agent-card">
            <h3>{agent.name}</h3>
            <p>Balance: {agent.balance.toLocaleString()} sats</p>
            <p>
              Txs sent/received: {agent.txsSent.toLocaleString()} / {agent.txsReceived.toLocaleString()}
            </p>
            <p>Active policies: {agent.activePolicies.toLocaleString()}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}
