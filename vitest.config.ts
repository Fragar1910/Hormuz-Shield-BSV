import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'packages/**/*.spec.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.vite/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts',
      ],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@hormuz/shared': path.resolve(__dirname, './packages/shared/src'),
      '@hormuz/risk-oracle': path.resolve(__dirname, './packages/risk-oracle/src'),
      '@hormuz/insurer-pool': path.resolve(__dirname, './packages/insurer-pool/src'),
      '@hormuz/shipowner': path.resolve(__dirname, './packages/shipowner/src'),
      '@hormuz/claims-verifier': path.resolve(__dirname, './packages/claims-verifier/src'),
    },
  },
});
