#!/usr/bin/env node
/**
 * Run All Agents - Start all HormuzShield agents concurrently
 * ============================================================
 * Starts Risk Oracle, Insurer Pool, Shipowner, and Claims Verifier
 */

const { spawn } = require('child_process');
const path = require('path');

const AGENTS = [
  { name: 'Risk Oracle', command: 'npm', args: ['run', 'start', '-w', 'packages/risk-oracle'], color: '\x1b[36m' },
  { name: 'Insurer Pool', command: 'npm', args: ['run', 'start', '-w', 'packages/insurer-pool'], color: '\x1b[33m' },
  { name: 'Shipowner', command: 'npm', args: ['run', 'start', '-w', 'packages/shipowner'], color: '\x1b[32m' },
  { name: 'Claims Verifier', command: 'npm', args: ['run', 'start', '-w', 'packages/claims-verifier'], color: '\x1b[35m' },
];

const RESET = '\x1b[0m';

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🚀 Starting HormuzShield Multi-Agent System');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

const processes = [];

// Start all agents
AGENTS.forEach(agent => {
  console.log(`${agent.color}[${agent.name}]${RESET} Starting...`);

  const proc = spawn(agent.command, agent.args, {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${agent.color}[${agent.name}]${RESET} ${line}`);
      }
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.error(`${agent.color}[${agent.name}]${RESET} ⚠️  ${line}`);
      }
    });
  });

  proc.on('close', (code) => {
    console.log(`${agent.color}[${agent.name}]${RESET} Exited with code ${code}`);
  });

  processes.push({ agent, proc });
});

console.log('');
console.log(`✅ ${AGENTS.length} agents started`);
console.log('Press Ctrl+C to stop all agents');
console.log('');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down all agents...\n');

  processes.forEach(({ agent, proc }) => {
    console.log(`${agent.color}[${agent.name}]${RESET} Stopping...`);
    proc.kill('SIGINT');
  });

  setTimeout(() => {
    console.log('\n✅ All agents stopped\n');
    process.exit(0);
  }, 2000);
});
