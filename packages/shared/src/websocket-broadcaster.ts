/**
 * WebSocket Broadcaster for Real-time UI Updates
 *
 * Broadcasts transaction events, vessel updates, and metrics to connected UI clients
 */

import { WebSocketServer, WebSocket } from 'ws';

export interface BroadcastMessage {
  type: 'tx' | 'vessels' | 'agents' | 'metrics' | 'txCount';
  data?: any;
  count?: number;
}

export class WebSocketBroadcaster {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log(`[WebSocket] Client connected (total: ${this.clients.size + 1})`);
      this.clients.add(ws);

      ws.on('close', () => {
        console.log(`[WebSocket] Client disconnected (total: ${this.clients.size - 1})`);
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', error.message);
        this.clients.delete(ws);
      });

      // Send initial connection confirmation
      this.sendToClient(ws, { type: 'txCount', count: 0 });
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocket] Server error:', error.message);
    });

    console.log(`[WebSocket] Server listening on port ${port}`);
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: BroadcastMessage): void {
    const payload = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (error: any) {
          console.error('[WebSocket] Broadcast error:', error.message);
          this.clients.delete(client);
        }
      }
    });
  }

  /**
   * Send a message to a specific client
   */
  private sendToClient(client: WebSocket, message: BroadcastMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error: any) {
        console.error('[WebSocket] Send error:', error.message);
      }
    }
  }

  /**
   * Broadcast a transaction event
   */
  broadcastTransaction(tx: {
    id: string;
    type: string;
    amount: number;
    from: string;
    to: string;
    timestamp: number;
    txid: string;
  }): void {
    this.broadcast({
      type: 'tx',
      data: tx,
    });
  }

  /**
   * Broadcast vessel updates
   */
  broadcastVessels(vessels: any[]): void {
    this.broadcast({
      type: 'vessels',
      data: vessels,
    });
  }

  /**
   * Broadcast agent status
   */
  broadcastAgents(agents: any[]): void {
    this.broadcast({
      type: 'agents',
      data: agents,
    });
  }

  /**
   * Broadcast metrics
   */
  broadcastMetrics(metrics: any): void {
    this.broadcast({
      type: 'metrics',
      data: metrics,
    });
  }

  /**
   * Broadcast transaction count
   */
  broadcastTxCount(count: number): void {
    this.broadcast({
      type: 'txCount',
      count,
    });
  }

  /**
   * Close the WebSocket server
   */
  close(): void {
    console.log('[WebSocket] Closing server...');
    this.clients.forEach((client) => client.close());
    this.wss.close();
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
