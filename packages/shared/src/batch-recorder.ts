/**
 * HormuzShield - Batch Recorder
 * Merkle tree batching for on-chain event recording
 * Reduces on-chain footprint from ~500K to ~5K txs/24h
 */

import crypto from 'crypto';

export interface BatchEvent {
  type: string;
  data: any;
  timestamp: number;
}

export interface BatchFlushResult {
  merkleRoot: string;
  eventCount: number;
  txid: string;
}

/**
 * Accumulates events and periodically flushes them as a Merkle root on-chain
 */
export class BatchRecorder {
  private buffer: BatchEvent[] = [];
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private agentName: string,
    private flushFn: (merkleRoot: string, count: number) => Promise<string>,
    private intervalMs: number = 60_000 // 1 minute default
  ) {}

  /**
   * Start the batch recorder
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.interval = setInterval(() => this.flush(), this.intervalMs);
    console.log(`[${this.agentName}] BatchRecorder started (interval: ${this.intervalMs}ms)`);
  }

  /**
   * Stop the batch recorder
   */
  stop(): void {
    if (!this.isRunning) return;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log(`[${this.agentName}] BatchRecorder stopped`);
  }

  /**
   * Add event to buffer
   */
  add(type: string, data: any): void {
    this.buffer.push({
      type,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Force flush current buffer
   */
  async forceFlush(): Promise<BatchFlushResult | null> {
    return this.flush();
  }

  /**
   * Flush buffer to chain
   */
  private async flush(): Promise<BatchFlushResult | null> {
    if (this.buffer.length === 0) {
      return null;
    }

    const events = [...this.buffer];
    const root = this.calculateMerkleRoot(events);
    const count = events.length;

    try {
      // Clear buffer before async call to avoid duplicates
      this.buffer = [];

      const txid = await this.flushFn(root, count);
      console.log(`[${this.agentName}] Batched ${count} events → tx ${txid.substring(0, 16)}...`);

      return { merkleRoot: root, eventCount: count, txid };
    } catch (error) {
      console.error(`[${this.agentName}] Batch flush failed:`, error);
      // Re-add events to buffer for retry
      this.buffer.unshift(...events);
      return null;
    }
  }

  /**
   * Calculate Merkle root of events
   */
  private calculateMerkleRoot(events: BatchEvent[]): string {
    if (events.length === 0) {
      return '0000000000000000000000000000000000000000000000000000000000000000';
    }

    // Hash each event
    const hashes = events.map(e =>
      crypto.createHash('sha256').update(JSON.stringify(e)).digest('hex')
    );

    // Build Merkle tree
    return this.buildMerkleTree(hashes);
  }

  /**
   * Build Merkle tree from hashes
   */
  private buildMerkleTree(hashes: string[]): string {
    if (hashes.length === 0) {
      return '0000000000000000000000000000000000000000000000000000000000000000';
    }

    let currentLevel = [...hashes];

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || left; // Duplicate last if odd

        const combined = crypto
          .createHash('sha256')
          .update(left + right)
          .digest('hex');

        nextLevel.push(combined);
      }

      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Get current buffer events (for debugging)
   */
  getBuffer(): BatchEvent[] {
    return [...this.buffer];
  }
}

/**
 * Create a simple hash of data
 */
export function hashData(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

/**
 * Verify if data matches a hash
 */
export function verifyHash(data: any, hash: string): boolean {
  return hashData(data) === hash;
}
