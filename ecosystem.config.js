/**
 * PM2 Ecosystem Configuration
 * ============================
 * Manages all HormuzShield agents and UI
 */

module.exports = {
  apps: [
    {
      name: 'risk-oracle',
      cwd: './packages/risk-oracle',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        ORACLE_PORT: 3001,
      },
    },
    {
      name: 'insurer-pool',
      cwd: './packages/insurer-pool',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        INSURER_PORT: 3002,
        RISK_ORACLE_URL: 'http://localhost:3001',
      },
    },
    {
      name: 'shipowner',
      cwd: './packages/shipowner',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        SHIPOWNER_PORT: 3003,
      },
    },
    {
      name: 'claims-verifier',
      cwd: './packages/claims-verifier',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        VERIFIER_PORT: 3004,
      },
    },
    {
      name: 'hormuz-ui',
      cwd: './packages/hormuz-ui',
      script: 'npm',
      args: 'run preview',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
      },
    },
  ],
};
