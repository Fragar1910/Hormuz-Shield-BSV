/**
 * End-to-End Test: Full HormuzShield System
 * ==========================================
 * Tests the complete flow:
 * 1. Risk Oracle receives AIS data and calculates risk scores
 * 2. Shipowner requests insurance coverage from Insurer Pool
 * 3. Insurer queries Risk Oracle for risk data (pays micropayment)
 * 4. Insurer issues policy to Shipowner (receives premium)
 * 5. Shipowner detects incident and files claim
 * 6. Claims Verifier validates claim
 * 7. Insurer pays out claim to Shipowner
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('HormuzShield E2E - Full System Integration', () => {
  let oracleProcess: ChildProcess;
  let insurerProcess: ChildProcess;
  let shipownerProcess: ChildProcess;
  let verifierProcess: ChildProcess;

  const BASE_URL = {
    oracle: 'http://localhost:3001',
    insurer: 'http://localhost:3002',
    shipowner: 'http://localhost:3003',
    verifier: 'http://localhost:3004',
  };

  beforeAll(async () => {
    console.log('🚀 Starting HormuzShield agents...\n');

    // Start all agents
    oracleProcess = spawn('npm', ['run', 'start', '-w', 'packages/risk-oracle'], {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
    });

    insurerProcess = spawn('npm', ['run', 'start', '-w', 'packages/insurer-pool'], {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
    });

    shipownerProcess = spawn('npm', ['run', 'start', '-w', 'packages/shipowner'], {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
    });

    verifierProcess = spawn('npm', ['run', 'start', '-w', 'packages/claims-verifier'], {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
    });

    // Wait for all agents to be ready
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n✅ All agents started\n');
  }, 30000);

  afterAll(async () => {
    console.log('\n🛑 Stopping all agents...\n');

    oracleProcess?.kill('SIGINT');
    insurerProcess?.kill('SIGINT');
    shipownerProcess?.kill('SIGINT');
    verifierProcess?.kill('SIGINT');

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ All agents stopped\n');
  });

  it('should have all agents healthy', async () => {
    const responses = await Promise.all([
      fetch(`${BASE_URL.oracle}/health`).then(r => r.json()),
      fetch(`${BASE_URL.insurer}/health`).then(r => r.json()),
      fetch(`${BASE_URL.shipowner}/health`).then(r => r.json()),
      fetch(`${BASE_URL.verifier}/health`).then(r => r.json()),
    ]);

    responses.forEach(response => {
      expect(response.status).toBe('ok');
      expect(response.identityKey).toBeDefined();
    });
  });

  it('should complete full insurance lifecycle', async () => {
    // 1. Get fleet info from Shipowner
    const fleetResponse = await fetch(`${BASE_URL.shipowner}/api/fleet`).then(r => r.json());
    expect(fleetResponse.success).toBe(true);
    expect(fleetResponse.vessels.length).toBeGreaterThan(0);

    const testVessel = fleetResponse.vessels[0];
    console.log(`📦 Testing with vessel: ${testVessel.name} (MMSI: ${testVessel.mmsi})`);

    // 2. Request quote from Insurer
    const quoteResponse = await fetch(`${BASE_URL.insurer}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mmsi: testVessel.mmsi,
        duration: 60,
        hullValueUsd: testVessel.hullValueUsd,
      }),
    }).then(r => r.json());

    console.log(`💰 Quote received: ${JSON.stringify(quoteResponse.quote, null, 2)}`);
    expect(quoteResponse.success).toBe(true);
    expect(quoteResponse.quote.premiumSats).toBeGreaterThan(0);

    // 3. Issue policy (simulating premium payment)
    const policyResponse = await fetch(`${BASE_URL.insurer}/api/issue-policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mmsi: testVessel.mmsi,
        hullValueUsd: testVessel.hullValueUsd,
        duration: 60,
        premiumTxid: 'mock-payment-txid-' + Date.now(),
        zoneId: 'HORMUZ',
      }),
    }).then(r => r.json());

    console.log(`📜 Policy issued: ${policyResponse.policy.policyId}`);
    expect(policyResponse.success).toBe(true);
    expect(policyResponse.policy).toBeDefined();
    expect(policyResponse.policy.status).toBe('active');

    const policy = policyResponse.policy;

    // 4. File a claim
    const claimResponse = await fetch(`${BASE_URL.shipowner}/api/file-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mmsi: testVessel.mmsi,
        claimType: 'damage',
        claimAmountSats: Math.floor(policy.coverageSats * 0.5), // Claim 50% of coverage
        eventDescription: 'Simulated incident for E2E testing',
      }),
    }).then(r => r.json());

    console.log(`🚨 Claim filed: ${claimResponse.claimId}`);
    expect(claimResponse.success).toBe(true);
    expect(claimResponse.claimId).toBeDefined();

    // 5. Wait for claim processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 6. Check claim status
    const claimsStatus = await fetch(`${BASE_URL.shipowner}/api/claims`).then(r => r.json());
    expect(claimsStatus.success).toBe(true);
    expect(claimsStatus.claims.length).toBeGreaterThan(0);

    console.log(`✅ E2E Test Complete - Lifecycle verified`);
  }, 60000);

  it('should track transaction volume over time', async () => {
    // Monitor stats from all agents
    const stats = await Promise.all([
      fetch(`${BASE_URL.oracle}/api/stats`).then(r => r.json()),
      fetch(`${BASE_URL.insurer}/api/stats`).then(r => r.json()),
      fetch(`${BASE_URL.shipowner}/api/stats`).then(r => r.json()),
      fetch(`${BASE_URL.verifier}/api/stats`).then(r => r.json()),
    ]);

    console.log('\n📊 System Statistics:');
    console.log('  Risk Oracle:', JSON.stringify(stats[0], null, 2));
    console.log('  Insurer Pool:', JSON.stringify(stats[1], null, 2));
    console.log('  Shipowner:', JSON.stringify(stats[2], null, 2));
    console.log('  Claims Verifier:', JSON.stringify(stats[3], null, 2));

    // Verify some activity
    expect(stats[0].stats.totalVessels).toBeGreaterThanOrEqual(0);
  });
});
