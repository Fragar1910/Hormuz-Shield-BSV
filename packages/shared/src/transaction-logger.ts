/**
 * Transaction Logger
 * ==================
 * Logs all BSV transactions to JSONL file for evidence
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TransactionLog {
  timestamp: string;
  network: 'main' | 'test';
  agent_from: string;
  agent_to: string;
  type: string;
  txid: string;
  amount_sats: number;
  block_height: number | null;
  confirmations: number;
  fees_sats: number;
  size_bytes: number;
  metadata: any;
  wallet_from_address: string;
  wallet_to_address: string;
  verified_on_chain: boolean;
}

export class TransactionLogger {
  private logFile: string;
  private network: 'main' | 'test';
  private onTransactionCallback?: (tx: TransactionLog) => void;

  constructor(network: 'main' | 'test', logFile?: string) {
    this.network = network;
    this.logFile = logFile || path.resolve(process.cwd(), 'logs', 'transactions.jsonl');

    // Ensure logs directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Set callback to be called when a transaction is logged
   * Useful for real-time UI updates via WebSocket
   */
  onTransaction(callback: (tx: TransactionLog) => void): void {
    this.onTransactionCallback = callback;
  }

  /**
   * Log a transaction
   */
  log(tx: Omit<TransactionLog, 'timestamp' | 'network'>): void {
    const logEntry: TransactionLog = {
      timestamp: new Date().toISOString(),
      network: this.network,
      ...tx,
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      fs.appendFileSync(this.logFile, logLine);

      // Call callback if set (for real-time UI updates)
      if (this.onTransactionCallback) {
        this.onTransactionCallback(logEntry);
      }
    } catch (error) {
      console.error('[TxLogger] Failed to write log:', (error as Error).message);
    }
  }

  /**
   * Get total transaction count
   */
  getCount(): number {
    try {
      if (!fs.existsSync(this.logFile)) {
        return 0;
      }

      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.trim().split('\n');
      return lines.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get transactions by agent
   */
  getByAgent(agent: string): TransactionLog[] {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.trim().split('\n').filter(l => l);

      return lines
        .map(line => JSON.parse(line))
        .filter((tx: TransactionLog) => tx.agent_from === agent || tx.agent_to === agent);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get recent transactions
   */
  getRecent(count: number = 100): TransactionLog[] {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.trim().split('\n').filter(l => l);

      return lines
        .slice(-count)
        .map(line => JSON.parse(line));
    } catch (error) {
      return [];
    }
  }
}
