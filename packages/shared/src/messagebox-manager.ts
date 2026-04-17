/**
 * MessageBox Manager - BRC-100 P2P Communication
 *
 * Manages MessageBox client for agent-to-agent communication via BRC-100.
 * Handles service discovery, messaging, and identity management.
 */

import { MessageBoxClient, PeerMessage } from '@bsv/message-box-client';
import { WalletInterface } from '@bsv/sdk';
import { AgentMessage } from './types';

export interface MessageBoxConfig {
  walletClient: WalletInterface;
  serviceType: 'risk-oracle' | 'insurer-pool' | 'shipowner' | 'claims-verifier';
  messageBoxHost?: string;
  network?: 'mainnet' | 'testnet' | 'local';
}

export interface ServiceAdvertisement {
  serviceType: string;
  identityKey: string;
  capabilities: string[];
  endpoint?: string;
}

/**
 * MessageBoxManager - Wraps MessageBoxClient for HormuzShield agents
 *
 * Features:
 * - BRC-100 identity-based discovery
 * - Typed message sending/receiving
 * - Service capability advertisement
 * - Auto-initialization
 */
export class MessageBoxManager {
  private client: MessageBoxClient;
  private config: MessageBoxConfig;
  private initialized: boolean = false;
  private identityKey?: string;

  constructor(config: MessageBoxConfig) {
    this.config = config;

    // Create MessageBoxClient with appropriate network preset
    const networkPreset = config.network === 'testnet' ? 'testnet' :
                         config.network === 'local' ? 'local' : 'mainnet';

    this.client = new MessageBoxClient({
      walletClient: config.walletClient,
      host: config.messageBoxHost,
      networkPreset,
      enableLogging: process.env.NODE_ENV === 'development'
    });
  }

  /**
   * Initialize MessageBox client and advertise this agent's services
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    console.log(`[MessageBox] Initializing ${this.config.serviceType}...`);

    // Testnet MessageBox hosts are currently unavailable
    // Skip initialization to avoid wallet compatibility issues
    if (this.config.network === 'testnet') {
      throw new Error('MessageBox not available on testnet (no public hosts available)');
    }

    try {
      // Initialize the client (anoints host if needed)
      await this.client.init();

      // Get our identity key
      this.identityKey = await this.client.getIdentityKey();
      console.log(`[MessageBox] Identity: ${this.identityKey.substring(0, 20)}...`);

      // Initialize WebSocket connection for live messaging
      // Wrap in try-catch as this can fail with wallet errors
      try {
        await this.client.initializeConnection();
      } catch (connError: any) {
        console.warn(`[MessageBox] WebSocket connection failed: ${connError.message}`);
        console.warn(`[MessageBox] Will use HTTP-only mode`);
        // Continue without WebSocket - HTTP fallback will be used
      }

      this.initialized = true;
      console.log(`[MessageBox] ${this.config.serviceType} ready for P2P messaging`);
    } catch (error: any) {
      // Re-throw to let caller handle gracefully
      throw new Error(`MessageBox initialization failed: ${error.message || error}`);
    }
  }

  /**
   * Get this agent's identity key (BRC-100)
   */
  getIdentityKey(): string {
    if (!this.identityKey) {
      throw new Error('MessageBox not initialized. Call init() first.');
    }
    return this.identityKey;
  }

  /**
   * Send a message to another agent via MessageBox
   *
   * @param recipient - Identity key of recipient agent (BRC-100)
   * @param messageBox - Inbox name (e.g., 'risk_requests', 'quotes')
   * @param message - Typed message object
   */
  async sendMessage(
    recipient: string,
    messageBox: string,
    message: AgentMessage
  ): Promise<void> {
    if (!this.initialized) await this.init();

    const body = JSON.stringify(message);
    await this.client.sendMessage({
      recipient,
      messageBox,
      body
    });

    console.log(`[MessageBox] Sent ${message.type} to ${recipient.substring(0, 20)}... (${messageBox})`);
  }

  /**
   * Send a live message (WebSocket first, fallback to HTTP)
   */
  async sendLiveMessage(
    recipient: string,
    messageBox: string,
    message: AgentMessage
  ): Promise<void> {
    if (!this.initialized) await this.init();

    const body = JSON.stringify(message);
    await this.client.sendLiveMessage({
      recipient,
      messageBox,
      body
    });

    console.log(`[MessageBox] Sent live ${message.type} to ${recipient.substring(0, 20)}...`);
  }

  /**
   * List messages in a messageBox (inbox)
   *
   * @param messageBox - Inbox name to check
   * @returns Array of typed messages
   */
  async listMessages(messageBox: string): Promise<AgentMessage[]> {
    if (!this.initialized) await this.init();

    const messages = await this.client.listMessages({ messageBox });

    return messages.map(msg => {
      try {
        const bodyStr = typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body);
        const parsed = JSON.parse(bodyStr);
        return {
          from: msg.sender,
          to: this.identityKey!,
          type: parsed.type,
          payload: parsed.payload,
          timestamp: parsed.timestamp,
          txid: parsed.txid
        };
      } catch (e) {
        console.error('[MessageBox] Failed to parse message:', e);
        return {
          from: msg.sender,
          to: this.identityKey!,
          type: 'risk_query' as const,
          payload: msg.body,
          timestamp: Date.now()
        };
      }
    });
  }

  /**
   * Listen for live messages on a messageBox
   *
   * @param messageBox - Inbox to listen on
   * @param onMessage - Callback for each message
   */
  async listenForLiveMessages(
    messageBox: string,
    onMessage: (message: AgentMessage) => void | Promise<void>
  ): Promise<void> {
    if (!this.initialized) await this.init();

    console.log(`[MessageBox] Listening on ${messageBox}...`);

    await this.client.listenForLiveMessages({
      messageBox,
      onMessage: async (msg: PeerMessage) => {
        try {
          const bodyStr = typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body);
          const parsed = JSON.parse(bodyStr);
          const typedMessage: AgentMessage = {
            from: msg.sender,
            to: this.identityKey!,
            type: parsed.type,
            payload: parsed.payload,
            timestamp: parsed.timestamp,
            txid: parsed.txid
          };
          await onMessage(typedMessage);
        } catch (e) {
          console.error('[MessageBox] Failed to parse live message:', e);
        }
      }
    });
  }

  /**
   * Acknowledge (delete) messages from MessageBox
   *
   * @param messageIds - Array of message IDs to acknowledge
   */
  async acknowledgeMessages(messageIds: string[]): Promise<void> {
    if (!this.initialized) await this.init();

    if (messageIds.length === 0) return;

    await this.client.acknowledgeMessage({ messageIds });
    console.log(`[MessageBox] Acknowledged ${messageIds.length} messages`);
  }

  /**
   * Get service info for advertisement
   */
  getServiceInfo(): ServiceAdvertisement {
    return {
      serviceType: this.config.serviceType,
      identityKey: this.getIdentityKey(),
      capabilities: this.getCapabilities()
    };
  }

  /**
   * Get service capabilities based on agent type
   */
  private getCapabilities(): string[] {
    switch (this.config.serviceType) {
      case 'risk-oracle':
        return ['risk_score', 'zone_status', 'risk_feed', 'incident_report'];
      case 'insurer-pool':
        return ['quote', 'issue_policy', 'evaluate_claim', 'pool_stats'];
      case 'shipowner':
        return ['request_coverage', 'file_claim', 'fleet_status'];
      case 'claims-verifier':
        return ['verify_claim', 'validate_incident', 'verification_report'];
      default:
        return [];
    }
  }

  /**
   * Disconnect WebSocket gracefully
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnectWebSocket();
      console.log(`[MessageBox] ${this.config.serviceType} disconnected`);
    }
  }
}
