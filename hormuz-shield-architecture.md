# HormuzShield — Freight Insurance Micro-Settlement

## Technical Architecture Specification (SDD)

**Project:** Open Run Agentic Pay Hackathon — BSV Association
**Author:** Francisco Hipolito Garcia Martinez — Engineering Leader| Blockchain Developer Arquitecture CodeCrypto alumn
**Date:** April 2026
**Stack:** TypeScript + @bsv/sdk + @bsv/simple + Claude Agent SDK

---

## 1. Executive summary

HormuzShield is an autonomous multi-agent system that provides real-time, dynamic micro-insurance for maritime freight transiting high-risk zones. AI agents monitor vessel positions via AIS data, calculate risk scores second-by-second, and autonomously negotiate and settle insurance micro-premiums via BSV blockchain micropayments.

**Why now:** As of March 2026, war risk premiums in the Strait of Hormuz have surged to 1–5% of hull value (~$1M–$5M per VLCC transit). Quotes change hourly. Traditional insurance requires manual negotiation, 12–24h quote windows, and minimum 7-day coverage periods. HormuzShield replaces this with per-minute, autonomous, on-chain micro-insurance — making coverage accessible, granular, and transparent.

**Transaction volume justification:** With 50 simulated vessels × 6 risk zones × 1 position update/10s × 24h = ~2.6M meaningful transactions per day (position records, premium calculations, policy updates, claim evaluations, risk oracle feeds).

---

## 2. Problem statement

| Traditional war risk insurance | HormuzShield |
|-------------------------------|--------------|
| Manual quote request (12-24h) | Autonomous, real-time pricing |
| Minimum 7-day coverage | Per-minute micro-policies |
| Fixed premium (0.25%–5% H&M) | Dynamic, risk-adjusted micropremiums |
| Binary: covered or not | Graduated coverage zones |
| Opaque pricing | On-chain, auditable premiums |
| Human broker required | Agent-to-agent negotiation |
| No granular data on transit risk | Continuous AIS-backed risk scoring |

---

## 3. Agent architecture

### 3.1 Agent roster (4 agents, minimum 2 required by hackathon)

```
┌─────────────────────────────────────────────────────────┐
│                    HormuzShield System                    │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  RISK ORACLE  │───▶│  INSURER     │                   │
│  │  Agent        │    │  POOL Agent  │                   │
│  │              │    │              │                   │
│  │ • AIS feed    │    │ • Accepts     │                   │
│  │ • Risk calc   │    │   premiums   │                   │
│  │ • Zone monitor│    │ • Evaluates   │                   │
│  │ • Sells data  │    │   claims     │                   │
│  └──────┬───────┘    │ • Manages     │                   │
│         │            │   pool        │                   │
│         │micropay    └──────┬───────┘                   │
│         │per query          │policy                     │
│         ▼                   ▼updates                    │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  SHIPOWNER   │───▶│  CLAIMS      │                   │
│  │  Agent       │    │  VERIFIER    │                   │
│  │              │    │  Agent       │                   │
│  │ • Requests    │    │              │                   │
│  │   coverage   │    │ • Validates   │                   │
│  │ • Pays micro- │    │   incidents  │                   │
│  │   premiums   │    │ • Cross-refs  │                   │
│  │ • Receives    │    │   AIS data   │                   │
│  │   payouts    │    │ • Triggers    │                   │
│  └──────────────┘    │   settlements │                   │
│                      └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Agent specifications

#### Agent 1: Risk Oracle (`risk-oracle`)

**Purpose:** Ingests real-time AIS data, computes risk scores per zone, and sells risk data to other agents via BSV micropayments.

**BSV wallet:** Server-side wallet via `@bsv/simple/server`

**Data sources:**
- AIS WebSocket feed from aisstream.io (free, real-time)
- Pre-defined risk zone polygons (Hormuz, Bab el-Mandeb, Gulf of Aden, etc.)
- Historical incident database (static JSON seed data)

**Outputs sold (per micropayment):**
- `GET /risk-score/{mmsi}` → current risk score for a vessel (1 sat)
- `GET /zone-status/{zone_id}` → current threat level for a zone (1 sat)
- `GET /risk-feed` → streaming risk updates subscription (1 sat/update)
- `POST /incident-report` → new incident evaluation (5 sats)

**Risk calculation model:**
```typescript
interface RiskScore {
  vessel_mmsi: string;
  timestamp: number;
  zone_id: string;
  base_risk: number;          // 0.0–1.0, from zone threat level
  proximity_risk: number;     // distance to last known incident
  speed_anomaly: number;      // deviation from expected speed
  course_anomaly: number;     // deviation from shipping lane
  aggregate_risk: number;     // weighted composite
  confidence: number;         // data freshness factor
  premium_basis_bps: number;  // suggested premium in basis points
}
```

**Transaction generation:**
- Every AIS position update → 1 tx (record to chain)
- Every risk score calculation → 1 tx (sold to buyer agents)
- Every zone status update → 1 tx (broadcast to subscribers)
- Estimated: ~800K–1M txs/24h from this agent alone

---

#### Agent 2: Insurer Pool (`insurer-pool`)

**Purpose:** Manages an insurance pool, accepts premiums from shipowners, issues micro-policies, evaluates claims, and settles payouts. Autonomous pricing engine adjusts premiums based on oracle risk data.

**BSV wallet:** Server-side wallet, acts as pool treasury

**Interactions:**
- BUYS risk data from Risk Oracle (pays per query)
- SELLS insurance policies to Shipowner agents
- PAYS claims to Shipowner agents on verified incidents
- PAYS verification fees to Claims Verifier

**Policy model:**
```typescript
interface MicroPolicy {
  policy_id: string;           // BSV tx hash
  vessel_mmsi: string;
  zone_id: string;
  start_time: number;
  duration_seconds: number;    // typically 60s (1-minute policies)
  hull_value_usd: number;
  premium_sats: number;        // calculated from risk score
  coverage_sats: number;       // max payout on claim
  risk_score_at_issuance: number;
  status: 'active' | 'expired' | 'claimed' | 'settled';
}
```

**Pricing engine:**
```
premium_sats = hull_value_sats × risk_score × duration_factor × pool_utilization_factor
```

Where:
- `hull_value_sats`: vessel H&M value converted to satoshis
- `risk_score`: 0.0–1.0 from Risk Oracle
- `duration_factor`: 1/1440 for 1-minute policy (1 day = 1440 minutes)
- `pool_utilization_factor`: 1.0–2.0 based on current pool exposure

**Transaction generation:**
- Every policy issuance → 1 tx
- Every premium payment received → 1 tx
- Every risk data purchase → 1 tx
- Every claim settlement → 1 tx
- Pool rebalancing events → 1 tx each
- Estimated: ~600K–800K txs/24h

---

#### Agent 3: Shipowner (`shipowner`)

**Purpose:** Represents a vessel owner. Monitors its fleet, requests insurance coverage, pays premiums, and files claims when incidents are detected.

**BSV wallet:** Server-side wallet, funded for premium payments

**Fleet (simulated):**
- 50 vessels with realistic MMSI numbers
- Each vessel follows a pre-defined route through risk zones
- Position updates every 10 seconds (simulated from real shipping lanes)

**Behavior loop (per vessel, every 60 seconds):**
1. Check current position → determine active risk zone
2. Query Risk Oracle for current risk score (micropayment)
3. If in risk zone AND no active policy → request policy from Insurer Pool
4. Pay premium via BSV micropayment
5. If incident detected → file claim with Claims Verifier
6. Monitor for payout

**Transaction generation:**
- Risk queries: 50 vessels × 1/min × 1440 min = 72,000 txs/24h
- Policy payments: 50 vessels × 1/min (in zones) × ~720 min avg = 36,000 txs/24h
- Position attestations: 50 × 6/min × 1440 = 432,000 txs/24h
- Total: ~540K txs/24h

---

#### Agent 4: Claims Verifier (`claims-verifier`)

**Purpose:** Independent verification agent. Cross-references AIS data, risk oracle reports, and external signals to validate or reject insurance claims. Earns fees for each verification.

**BSV wallet:** Server-side wallet, earns verification fees

**Verification process:**
1. Receive claim from Shipowner (with evidence: position, timestamp)
2. Query Risk Oracle for historical risk data at that time/location (micropayment)
3. Cross-reference AIS data for anomalies (speed drops, course changes, AIS gaps)
4. Generate verification score (0.0–1.0)
5. If score > threshold → approve claim → notify Insurer Pool
6. Earn verification fee from Insurer Pool

**Incident detection heuristics:**
```typescript
interface IncidentSignal {
  type: 'ais_gap' | 'speed_anomaly' | 'course_deviation' | 'proximity_alert' | 'zone_escalation';
  severity: number;           // 0.0–1.0
  vessel_mmsi: string;
  position: { lat: number; lon: number };
  timestamp: number;
  evidence: string;           // descriptive
}
```

**Transaction generation:**
- Verification requests processed: ~200K txs/24h
- Oracle queries for verification: ~200K txs/24h
- Total: ~400K txs/24h

---

### 3.3 Transaction volume summary

| Agent | Txs/24h estimate |
|-------|-----------------|
| Risk Oracle | ~900K |
| Insurer Pool | ~700K |
| Shipowner (50 vessels) | ~540K |
| Claims Verifier | ~400K |
| **TOTAL** | **~2.54M** |

**Buffer over 1.5M requirement: 69%** — provides margin for network issues or slower periods.

---

## 4. BSV integration architecture

### 4.1 Wallet setup (per agent)

```typescript
import { Wallet } from '@bsv/simple/server';

// Each agent creates its own server-side wallet
const wallet = new Wallet({
  chain: 'main',             // mainnet for hackathon demo
  rootKey: process.env.AGENT_ROOT_KEY,  // HD key per agent
  storageEngine: 'sqlite'    // local SQLite for UTXO tracking
});
```

### 4.2 P2P messaging via MessageBox

Agents discover and communicate through MessageBox (BRC-100 compliant):

```typescript
import { MessageBoxClient } from '@bsv/message-box-client';

// Agent registration and discovery
const msgBox = new MessageBoxClient({
  host: 'https://messagebox.babbage.systems',
  walletClient: wallet
});

// Risk Oracle publishes to 'risk_feed' inbox
await msgBox.sendMessage({
  recipient: shipownerIdentityKey,
  messageBox: 'insurance_quotes',
  body: JSON.stringify(microPolicy)
});

// Shipowner listens for quotes
const messages = await msgBox.listMessages({
  messageBox: 'insurance_quotes'
});
```

### 4.3 Payment flow (micropayment per service call)

Using BSV's payment-express-middleware pattern adapted for agent-to-agent:

```typescript
import { PeerPayClient } from '@bsv/message-box-client';

// Shipowner pays Risk Oracle for data
const peerPay = new PeerPayClient({
  walletClient: shipownerWallet,
  host: 'https://messagebox.babbage.systems'
});

// Send 1 sat payment with data request
await peerPay.sendPayment({
  recipient: riskOracleIdentityKey,
  amount: 1,  // satoshis
  messageBox: 'risk_data_payments',
  body: JSON.stringify({
    type: 'risk_query',
    mmsi: '368207620',
    timestamp: Date.now()
  })
});
```

### 4.4 On-chain data recording

Each significant event is recorded on-chain via OP_RETURN:

```typescript
import { Transaction, P2PKH, OP } from '@bsv/sdk';

// Record risk score on-chain
const tx = new Transaction();
tx.addOutput({
  script: new Script([
    OP.OP_FALSE,
    OP.OP_RETURN,
    Buffer.from('HORMUZ'),           // protocol prefix
    Buffer.from(JSON.stringify({
      type: 'risk_score',
      mmsi: vessel.mmsi,
      zone: 'HORMUZ_EAST',
      score: 0.73,
      timestamp: Date.now()
    }))
  ]),
  satoshis: 0
});
// Add payment output + change
tx.addOutput({ lockingScript: P2PKH.lock(recipientAddress), satoshis: 1 });
```

---

## 5. Risk zone model

### 5.1 Predefined zones (GeoJSON polygons)

```typescript
const RISK_ZONES = {
  HORMUZ_STRAIT: {
    id: 'HORMUZ_STRAIT',
    name: 'Strait of Hormuz — Critical Transit',
    base_threat: 0.85,
    polygon: [
      [56.0, 26.0], [56.5, 26.5], [56.8, 26.8],
      [57.0, 26.5], [56.5, 25.8], [56.0, 26.0]
    ],
    jwla_listed: true,  // Joint War Committee Listed Area (JWLA-033)
    current_awrp_range: '1%–5% H&M'  // as of March 2026
  },
  PERSIAN_GULF_NORTH: {
    id: 'PG_NORTH',
    name: 'Northern Persian Gulf',
    base_threat: 0.65,
    polygon: [/* ... */],
    jwla_listed: true,
    current_awrp_range: '0.5%–2% H&M'
  },
  GULF_OF_OMAN: {
    id: 'GULF_OMAN',
    name: 'Gulf of Oman Approach',
    base_threat: 0.40,
    polygon: [/* ... */],
    jwla_listed: true,
    current_awrp_range: '0.25%–1% H&M'
  },
  BAB_EL_MANDEB: {
    id: 'BAB_MANDEB',
    name: 'Bab el-Mandeb Strait',
    base_threat: 0.70,
    polygon: [/* ... */],
    jwla_listed: true,
    current_awrp_range: '0.5%–3% H&M'
  },
  GULF_OF_ADEN: {
    id: 'GULF_ADEN',
    name: 'Gulf of Aden',
    base_threat: 0.55,
    polygon: [/* ... */],
    jwla_listed: true,
    current_awrp_range: '0.25%–1.5% H&M'
  },
  SAFE_WATERS: {
    id: 'SAFE',
    name: 'Open Ocean / Safe Transit',
    base_threat: 0.05,
    polygon: null,  // default for non-listed areas
    jwla_listed: false,
    current_awrp_range: '0%'
  }
};
```

### 5.2 Dynamic risk modifiers

```typescript
interface RiskModifiers {
  recent_incidents_24h: number;     // count → multiplier
  time_of_day: 'day' | 'night';    // night = 1.3x
  vessel_type: string;              // tanker = 1.5x, container = 1.0x, LNG = 2.0x
  vessel_flag: string;              // certain flags = higher risk
  convoy_status: boolean;           // with naval escort = 0.3x
  ais_density: number;              // high traffic = lower individual risk
  geopolitical_escalation: number;  // 0.0–1.0, manual or news-feed based
}
```

---

## 6. Web UI specification

### 6.1 Dashboard components

The UI is a single-page React application showing real-time agent activity:

**Map view (main panel):**
- Interactive map (Leaflet.js) showing the Persian Gulf / Gulf of Oman region
- Vessel markers with color-coded risk levels (green → yellow → red)
- Risk zone polygons overlaid with transparency
- Animated transaction paths between agents (particle effects on payment)

**Agent status panel (sidebar):**
- 4 agent cards showing: wallet balance, txs sent/received, active policies
- Real-time transaction counter (approaching 1.5M target)
- Agent-to-agent payment flow visualization

**Transaction feed (bottom panel):**
- Scrolling feed of recent transactions
- Each tx shows: type, amount (sats), from → to, timestamp, BSV txid link

**Metrics panel (top bar):**
- Total transactions (live counter)
- Total BSV volume (sats)
- Active policies count
- Current average risk score across fleet
- Claims filed / settled

### 6.2 Tech stack for UI

```
React 18 + TypeScript
Leaflet.js (map)
Recharts (metrics charts)
WebSocket connection to agent backend
Tailwind CSS for styling
```

---

## 7. Project structure

```
hormuz-shield/
├── packages/
│   ├── shared/                    # Shared types, risk model, zone definitions
│   │   ├── src/
│   │   │   ├── types.ts           # All interfaces
│   │   │   ├── risk-zones.ts      # Zone polygons and base threats
│   │   │   ├── risk-calculator.ts # Risk scoring engine
│   │   │   └── config.ts          # System constants
│   │   └── package.json
│   │
│   ├── risk-oracle/               # Agent 1
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point
│   │   │   ├── ais-client.ts      # AIS WebSocket ingestion
│   │   │   ├── risk-engine.ts     # Risk calculation loop
│   │   │   ├── data-store.ts      # In-memory + on-chain storage
│   │   │   └── payment-server.ts  # Express + payment middleware
│   │   └── package.json
│   │
│   ├── insurer-pool/              # Agent 2
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── pricing-engine.ts  # Dynamic premium calculator
│   │   │   ├── policy-manager.ts  # Issue/track/expire policies
│   │   │   ├── pool-treasury.ts   # Balance management
│   │   │   └── claims-handler.ts  # Claim evaluation
│   │   └── package.json
│   │
│   ├── shipowner/                 # Agent 3
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── fleet-simulator.ts # 50 vessels with route simulation
│   │   │   ├── coverage-manager.ts# Policy purchasing logic
│   │   │   ├── claim-filer.ts     # Incident detection + claim filing
│   │   │   └── routes/            # Pre-defined shipping lane routes
│   │   │       ├── hormuz-transit.json
│   │   │       ├── persian-gulf-loop.json
│   │   │       └── aden-suez.json
│   │   └── package.json
│   │
│   ├── claims-verifier/           # Agent 4
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── verification-engine.ts
│   │   │   ├── evidence-collector.ts
│   │   │   └── consensus.ts       # Multi-source cross-reference
│   │   └── package.json
│   │
│   └── web-ui/                    # Dashboard
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── MapView.tsx
│       │   │   ├── AgentPanel.tsx
│       │   │   ├── TxFeed.tsx
│       │   │   └── MetricsBar.tsx
│       │   └── hooks/
│       │       └── useAgentSocket.ts
│       └── package.json
│
├── scripts/
│   ├── fund-wallets.ts            # Fund agent wallets from desktop wallet
│   ├── generate-routes.ts         # Generate realistic vessel routes
│   └── run-all-agents.ts          # Start all agents concurrently
│
├── .env.example
├── package.json                   # Monorepo root (workspaces)
├── tsconfig.json
└── README.md
```

---

## 8. Development timeline (12 days: Apr 6–17)

### Phase 1: Foundation (Days 1–3)

- [ ] Monorepo setup with TypeScript + workspaces
- [ ] Shared types, interfaces, risk zone definitions
- [ ] BSV wallet initialization for all 4 agents
- [ ] MessageBox P2P connection between agents
- [ ] Basic payment flow: Agent A pays Agent B for data
- [ ] Verify first on-chain transactions

### Phase 2: Core agents (Days 4–7)

- [ ] Risk Oracle: AIS WebSocket ingestion + risk scoring
- [ ] Risk Oracle: payment middleware (pay-per-query)
- [ ] Insurer Pool: pricing engine + policy issuance
- [ ] Shipowner: fleet simulation (50 vessels, realistic routes)
- [ ] Shipowner: automatic policy purchasing loop
- [ ] Claims Verifier: verification engine + fee collection

### Phase 3: Transaction volume (Days 8–10)

- [ ] Tune polling intervals to reach 1.5M+ tx/24h target
- [ ] Add on-chain OP_RETURN recording for all events
- [ ] Stress test: run 24h burn and measure actual tx count
- [ ] Optimize UTXO management for high-frequency txs
- [ ] Add incident simulation (random events trigger claims)

### Phase 4: UI + polish (Days 11–12)

- [ ] Web dashboard: map with vessel markers
- [ ] Real-time transaction feed
- [ ] Agent status cards
- [ ] Transaction counter widget
- [ ] README + demo video recording
- [ ] Submission

---

## 9. Competitive advantages for judging

### "Solves a real, identifiable problem" ✓

The Strait of Hormuz crisis is front-page news in March-April 2026. War risk premiums are at 1-5% of hull value, changing hourly, and most shipowners cannot get coverage at all. HormuzShield demonstrates how autonomous agents can provide granular, real-time micro-insurance that the traditional P&I club system cannot.

### "At least 2 AI agents with their own BSV wallets" ✓

4 agents, each with independent server-side BSV wallets, discovering each other via MessageBox P2P, transacting autonomously.

### "At least 1.5M transactions in 24h window" ✓

Architecture targets ~2.5M txs/24h through natural, meaningful transactions: position records, risk queries, premium payments, policy issuances, claim verifications.

### "Agents discover each other using BRC-100 wallets and identity" ✓

All agents register identity keys and use MessageBox for P2P discovery and communication per BRC-100.

### "Agents transact autonomously" ✓

No human intervention once started. Risk Oracle sells data, Insurer prices and issues policies, Shipowner buys coverage, Verifier validates claims — all via BSV micropayments.

### "Human-facing web UI showing agent activity" ✓

Real-time dashboard with map, transaction feed, agent status, and metrics.

### Narrative differentiator

No other hackathon team will combine real-time AIS data, current geopolitical relevance (Hormuz crisis is literally happening right now), and domain expertise in industrial supply chain risk management. The judges will remember this project.

---

## 10. Technical risks and mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| BSV SDK learning curve (new stack) | HIGH | @bsv/simple-mcp in Claude Code + bsv-claude-agents for code generation |
| 1.5M tx volume target | HIGH | Conservative architecture already targets 2.5M; position attestations are bulk of volume |
| AIS API rate limits | MEDIUM | aisstream.io is free; fallback to simulated AIS data if needed |
| BSV mainnet fees for 2.5M txs | LOW | ~$25 total at current BSV fee rates |
| Wallet UTXO fragmentation | MEDIUM | Periodic UTXO consolidation in agent wallets |
| MessageBox server reliability | MEDIUM | Implement retry logic + fallback to direct HTTP between agents |
| Time pressure (12 days) | HIGH | Claude Code as copilot; SDD methodology ensures spec-first, less rework |

---

## 11. How Claude Code helps build this

### Setup

```bash
# Install BSV MCP for Claude Code context
npx @bsv/bsv-claude-agents

# Configure Claude Code MCP
# In .claude/mcp.json:
{
  "mcpServers": {
    "@bsv/mcp": {
      "command": "npx",
      "args": ["-y", "@bsv/mcp"],
      "env": {
        "BSV_REPOS_DIR": "./bsv-repos"
      }
    }
  }
}
```

### Development workflow with Claude Code

1. **Spec each module** (SDD methodology) → write interface + test first
2. **Claude Code generates** BSV wallet integration, MessageBox setup, payment middleware
3. **Test on BSV testnet** first → verify transactions
4. **Switch to mainnet** for final 24h demo window
5. **Claude Code generates** React UI components from spec

### Key Claude Code prompts

```
"Using @bsv/sdk, create a server-side wallet that can send 
micropayments to another agent's identity key via PeerPayClient"

"Create an Express middleware that requires 1 satoshi BSV payment 
per API call using payment-express-middleware pattern"

"Generate a fleet simulator that moves 50 vessels along 
predefined GeoJSON routes, emitting position updates every 10 seconds"

"Build a React component that displays a Leaflet map with 
real-time vessel markers colored by risk score"
```

---

## 12. Budget

| Item | Cost |
|------|------|
| BSV mainnet fees (~2.5M txs × $0.00001) | ~$25 |
| aisstream.io API | Free |
| VPS for 24h demo (4 agents + UI) | ~$20 (DigitalOcean) |
| BSV Desktop Wallet funding | ~$50 buffer |
| **Total** | **~$95** |

---

*"Fear is the invisible force behind the closure of the Strait of Hormuz."*
*— HormuzShield makes that fear quantifiable, tradeable, and settleable in real-time.*
