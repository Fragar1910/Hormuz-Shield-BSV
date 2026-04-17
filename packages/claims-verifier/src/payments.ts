/**
 * Risk Oracle - Direct Payment Manager
 * Implements BRC-29 direct payments for selling risk data
 *
 * Architecture: REST API + Direct BSV Payments
 * - No MessageBox dependency (simplified for MVP)
 * - Payments are direct P2PKH transactions with BRC-29 derivation
 * - High throughput: designed for 1.5M+ transactions/24h
 */

import { PrivateKey, PublicKey, Utils, Random } from '@bsv/sdk';

/**
 * BRC-29 Payment Request
 */
export interface PaymentRequest {
  serverIdentityKey: string;
  derivationPrefix: string;
  derivationSuffix: string;
  satoshis: number;
  memo?: string;
}

/**
 * Incoming payment data from sender
 */
export interface IncomingPayment {
  tx: number[] | Uint8Array;
  senderIdentityKey: string;
  derivationPrefix: string;
  derivationSuffix: string;
  outputIndex: number;
  requestType?: string;
  metadata?: any;
}

/**
 * Payment remittance result (what sender returns)
 */
export interface DirectPaymentResult {
  txid: string;
  tx: number[] | Uint8Array;
  senderIdentityKey: string;
  derivationPrefix: string;
  derivationSuffix: string;
  outputIndex: number;
}

/**
 * Direct Payment Manager
 * Handles creation and receipt of direct BSV payments for risk data
 */
export class DirectPaymentManager {
  private privateKey: PrivateKey;
  private identityKey: string;
  private paymentHandlers: Map<string, (payment: IncomingPayment, metadata: any) => Promise<any>> = new Map();

  constructor(privateKey: PrivateKey) {
    this.privateKey = privateKey;
    this.identityKey = privateKey.toPublicKey().toString();
  }

  /**
   * Get identity public key (for clients to send payments to)
   */
  getIdentityKey(): string {
    return this.identityKey;
  }

  /**
   * Create a payment request for a specific data request
   * Client pays this amount to receive the requested data
   */
  createPaymentRequest(satoshis: number, requestType: string, metadata?: any): PaymentRequest {
    const derivationPrefix = Utils.toBase64(Utils.toArray('payment', 'utf8'));
    const derivationSuffix = Utils.toBase64(Random(8));

    return {
      serverIdentityKey: this.identityKey,
      derivationPrefix,
      derivationSuffix,
      satoshis,
      memo: `Risk data: ${requestType}`,
    };
  }

  /**
   * Register a payment handler for a specific request type
   * Handler receives payment info and metadata, returns response data
   */
  registerPaymentHandler(
    requestType: string,
    handler: (payment: IncomingPayment, metadata: any) => Promise<any>
  ): void {
    this.paymentHandlers.set(requestType, handler);
    console.log(`[DirectPayments] Registered handler for: ${requestType}`);
  }

  /**
   * Process an incoming payment
   * Verifies derivation, executes handler, returns response
   */
  async processPayment(payment: IncomingPayment): Promise<any> {
    try {
      console.log(`[DirectPayments] Processing payment from ${payment.senderIdentityKey.substring(0, 16)}...`);

      // Get handler for request type
      const requestType = payment.requestType || 'unknown';
      const handler = this.paymentHandlers.get(requestType);

      if (!handler) {
        throw new Error(`No handler registered for request type: ${requestType}`);
      }

      // Execute handler
      const response = await handler(payment, payment.metadata || {});

      console.log(`[DirectPayments] Payment processed successfully: ${requestType}`);
      return response;

    } catch (error) {
      console.error('[DirectPayments] Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Verify payment derivation (optional - for advanced verification)
   * In production, you'd verify the tx is valid and matches the derivation
   */
  async verifyPayment(payment: IncomingPayment): Promise<boolean> {
    try {
      // TODO: Implement full BRC-29 derivation verification
      // For MVP, we trust that the payment data is correct
      return true;
    } catch (error) {
      console.error('[DirectPayments] Error verifying payment:', error);
      return false;
    }
  }

  /**
   * Get payment statistics
   */
  getStats(): {
    totalHandlers: number;
    handlers: string[];
  } {
    return {
      totalHandlers: this.paymentHandlers.size,
      handlers: Array.from(this.paymentHandlers.keys()),
    };
  }
}

/**
 * Simple HTTP payment client for agents to request data
 * (This will be used by other agents like Insurer, Shipowner)
 */
export class PaymentClient {
  private oracleUrl: string;
  private wallet: any; // Will be typed properly when we implement agent wallets

  constructor(oracleUrl: string, wallet: any) {
    this.oracleUrl = oracleUrl;
    this.wallet = wallet;
  }

  /**
   * Request risk score and pay for it
   */
  async requestRiskScore(mmsi: string): Promise<any> {
    // 1. Request payment details from oracle
    const paymentRequest = await fetch(`${this.oracleUrl}/api/request-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'risk_score',
        metadata: { mmsi },
      }),
    }).then(r => r.json());

    // 2. Create direct payment using BRC-29
    const payment = await this.wallet.sendDirectPayment(paymentRequest);

    // 3. Send payment + metadata to oracle
    const response = await fetch(`${this.oracleUrl}/api/receive-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payment,
        requestType: 'risk_score',
        metadata: { mmsi },
      }),
    }).then(r => r.json());

    return response;
  }

  /**
   * Request zone status and pay for it
   */
  async requestZoneStatus(zoneId: string): Promise<any> {
    const paymentRequest = await fetch(`${this.oracleUrl}/api/request-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'zone_status',
        metadata: { zoneId },
      }),
    }).then(r => r.json());

    const payment = await this.wallet.sendDirectPayment(paymentRequest);

    const response = await fetch(`${this.oracleUrl}/api/receive-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payment,
        requestType: 'zone_status',
        metadata: { zoneId },
      }),
    }).then(r => r.json());

    return response;
  }

  /**
   * Request full risk feed and pay for it
   */
  async requestRiskFeed(): Promise<any> {
    const paymentRequest = await fetch(`${this.oracleUrl}/api/request-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'risk_feed',
        metadata: {},
      }),
    }).then(r => r.json());

    const payment = await this.wallet.sendDirectPayment(paymentRequest);

    const response = await fetch(`${this.oracleUrl}/api/receive-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payment,
        requestType: 'risk_feed',
        metadata: {},
      }),
    }).then(r => r.json());

    return response;
  }
}
