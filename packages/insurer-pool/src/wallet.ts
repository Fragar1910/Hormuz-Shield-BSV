/**
 * Risk Oracle - BSV Wallet Manager (Direct Payments)
 * Implements BRC-29 direct payments pattern
 */

import {
  PrivateKey,
  PublicKey,
  P2PKH,
  Script,
  OP,
  Utils,
  Random,
  WalletInterface,
  GetPublicKeyResult,
  CreateSignatureResult,
  CreateHmacResult,
  VerifyHmacResult,
  WalletEncryptResult,
  WalletDecryptResult,
  Hash,
  SymmetricKey,
  AuthenticatedResult,
  GetHeightResult,
  GetNetworkResult,
  GetVersionResult,
} from '@bsv/sdk';
import type {
  PaymentRequest,
  IncomingPayment,
  DirectPaymentResult,
} from './payments';
import { BSVTransactionBuilder, TransactionLogger, BroadcastEndpoint } from '@hormuz/shared';

export interface AgentWalletConfig {
  privateKeyWif: string;
  network: 'main' | 'test';
  arcUrl?: string;
  arcApiKey?: string;
}

/**
 * Agent Wallet with Direct Payment Support
 * Implements BRC-29 payment protocol for P2P transactions
 */
export class AgentWallet {
  private privateKey: PrivateKey;
  public network: 'main' | 'test';
  public address: string;
  public identityKey: string;
  private txBuilder: BSVTransactionBuilder;
  private txLogger: TransactionLogger;

  constructor(config: AgentWalletConfig) {
    this.privateKey = PrivateKey.fromWif(config.privateKeyWif);
    this.network = config.network;

    const publicKey = this.privateKey.toPublicKey();
    this.identityKey = publicKey.toString();
    this.address = publicKey
      .toAddress(config.network === 'test' ? 'testnet' : undefined)
      .toString();

    // Parse broadcast endpoints from env (comma-separated)
    const endpointsEnv = process.env.BSV_BROADCAST_ENDPOINTS || 'whatsonchain,arc,gorillapool';
    const broadcastEndpoints = endpointsEnv.split(',').map(e => e.trim()) as BroadcastEndpoint[];

    // Initialize REAL BSV transaction builder
    this.txBuilder = new BSVTransactionBuilder({
      privateKeyWif: config.privateKeyWif,
      network: config.network,
      broadcastEndpoints,
      arcUrl: config.arcUrl || process.env.ARC_URL,
      arcApiKey: config.arcApiKey || process.env.ARC_API_KEY,
    });

    // Initialize transaction logger
    this.txLogger = new TransactionLogger(config.network);

    console.log(`[Wallet] Initialized for ${this.network}`);
    console.log(`[Wallet] Address: ${this.address}`);
    console.log(`[Wallet] Identity Key: ${this.identityKey.substring(0, 32)}...`);
  }

  /**
   * Get identity public key (BRC-100 compatible)
   */
  getIdentityKey(): string {
    return this.identityKey;
  }

  /**
   * Get address
   */
  getAddress(): string {
    return this.address;
  }

  /**
   * Get private key (use with caution!)
   */
  getPrivateKey(): PrivateKey {
    return this.privateKey;
  }

  /**
   * Get WalletInterface for BRC-100 MessageBox compatibility
   */
  getClient(): WalletInterface {
    const privateKey = this.privateKey;

    return {
      async getPublicKey(): Promise<GetPublicKeyResult> {
        const pubKey = privateKey.toPublicKey();
        return {
          publicKey: pubKey.toString()
        };
      },

      async createSignature(args: {
        data?: number[];
        hashToDirectlySign?: number[];
        protocolID: [number, string];
        keyID: string;
        counterparty?: string;
        privileged?: boolean;
      }): Promise<CreateSignatureResult> {
        const dataToSign = args.hashToDirectlySign || args.data;
        if (!dataToSign) {
          throw new Error('Either data or hashToDirectlySign must be provided');
        }

        const hash = args.hashToDirectlySign || Hash.sha256(dataToSign);
        const sig = privateKey.sign(hash);

        return {
          signature: sig.toDER() as number[]
        };
      },

      async createHmac(args: {
        data: number[];
        protocolID: [number, string];
        keyID: string;
        counterparty?: string;
        privileged?: boolean;
      }): Promise<CreateHmacResult> {
        const keyData = privateKey.toWif();
        const hmacKey = Hash.sha256(Utils.toArray(keyData + args.protocolID.join(':') + args.keyID, 'utf8'));
        const hmac = Hash.sha256hmac(hmacKey, args.data);

        return {
          hmac: Array.from(hmac)
        };
      },

      async verifyHmac(args: {
        data: number[];
        hmac: number[];
        protocolID: [number, string];
        keyID: string;
        counterparty?: string;
        privileged?: boolean;
      }): Promise<VerifyHmacResult> {
        const keyData = privateKey.toWif();
        const hmacKey = Hash.sha256(Utils.toArray(keyData + args.protocolID.join(':') + args.keyID, 'utf8'));
        const expectedHmac = Hash.sha256hmac(hmacKey, args.data);

        const valid = Array.from(expectedHmac).every(
          (byte, i) => byte === args.hmac[i]
        ) as true;

        return {
          valid
        };
      },

      async encrypt(args: {
        plaintext: number[];
        protocolID: [number, string];
        keyID: string;
        counterparty?: string;
        privileged?: boolean;
      }): Promise<WalletEncryptResult> {
        const keyData = privateKey.toWif();
        const encKey = Hash.sha256(Utils.toArray(keyData + args.protocolID.join(':') + args.keyID, 'utf8'));
        const symmetricKey = new SymmetricKey(encKey);
        const ciphertext = symmetricKey.encrypt(args.plaintext);

        return {
          ciphertext: ciphertext as number[]
        };
      },

      async decrypt(args: {
        ciphertext: number[];
        protocolID: [number, string];
        keyID: string;
        counterparty?: string;
        privileged?: boolean;
      }): Promise<WalletDecryptResult> {
        const keyData = privateKey.toWif();
        const decKey = Hash.sha256(Utils.toArray(keyData + args.protocolID.join(':') + args.keyID, 'utf8'));
        const symmetricKey = new SymmetricKey(decKey);
        const plaintext = symmetricKey.decrypt(args.ciphertext);

        return {
          plaintext: plaintext as number[]
        };
      },

      // Required stubs for unused WalletInterface methods
      async createAction() {
        throw new Error('createAction not implemented in minimal wallet');
      },
      async signAction() {
        throw new Error('signAction not implemented in minimal wallet');
      },
      async abortAction() {
        throw new Error('abortAction not implemented in minimal wallet');
      },
      async listActions() {
        return { actions: [], totalActions: 0 };
      },
      async internalizeAction() {
        throw new Error('internalizeAction not implemented in minimal wallet');
      },
      async listOutputs() {
        return { outputs: [], totalOutputs: 0 };
      },
      async relinquishOutput() {
        throw new Error('relinquishOutput not implemented in minimal wallet');
      },
      async acquireCertificate() {
        throw new Error('acquireCertificate not implemented in minimal wallet');
      },
      async listCertificates() {
        return { certificates: [], totalCertificates: 0 };
      },
      async proveCertificate() {
        throw new Error('proveCertificate not implemented in minimal wallet');
      },
      async relinquishCertificate() {
        throw new Error('relinquishCertificate not implemented in minimal wallet');
      },
      async discoverByIdentityKey() {
        return { certificates: [], totalCertificates: 0 };
      },
      async discoverByAttributes() {
        return { certificates: [], totalCertificates: 0 };
      },
      async revealCounterpartyKeyLinkage() {
        throw new Error('revealCounterpartyKeyLinkage not implemented in minimal wallet');
      },
      async revealSpecificKeyLinkage() {
        throw new Error('revealSpecificKeyLinkage not implemented in minimal wallet');
      },
      async verifySignature() {
        throw new Error('verifySignature not implemented in minimal wallet');
      },
      async isAuthenticated(): Promise<AuthenticatedResult> {
        return { authenticated: true };
      },
      async waitForAuthentication(): Promise<AuthenticatedResult> {
        return { authenticated: true };
      },
      async getHeight(): Promise<GetHeightResult> {
        return { height: 0 };
      },
      async getHeaderForHeight() {
        throw new Error('getHeaderForHeight not implemented in minimal wallet');
      },
      async getNetwork(): Promise<GetNetworkResult> {
        return { network: 'mainnet' };
      },
      async getVersion(): Promise<GetVersionResult> {
        return { version: '1.0.0' };
      }
    };
  }

  // ============================================================================
  // Direct Payment Methods (BRC-29)
  // ============================================================================

  /**
   * Create a payment request for others to pay us
   * Generates BRC-29 derivation data
   */
  createPaymentRequest(options: { satoshis: number; memo?: string }): PaymentRequest {
    const derivationPrefix = Utils.toBase64(Utils.toArray('payment', 'utf8'));
    const derivationSuffix = Utils.toBase64(Random(8));

    return {
      serverIdentityKey: this.identityKey,
      derivationPrefix,
      derivationSuffix,
      satoshis: options.satoshis,
      memo: options.memo,
    };
  }

  /**
   * Send a direct payment to another identity
   * Creates REAL BSV P2PKH transaction and broadcasts to blockchain
   */
  async sendDirectPayment(request: PaymentRequest): Promise<DirectPaymentResult> {
    try {
      // Get recipient address from their identity key
      const recipientPubKey = PublicKey.fromString(request.serverIdentityKey);
      const recipientAddress = recipientPubKey.toAddress(
        this.network === 'test' ? 'testnet' : undefined
      ).toString();

      // Create and broadcast REAL BSV transaction
      const { txid, rawTx } = await this.txBuilder.sendPayment(
        recipientAddress,
        request.satoshis,
        request.memo
      );

      // Log transaction for evidence
      this.txLogger.log({
        agent_from: 'insurer',
        agent_to: 'recipient',
        type: 'direct_payment',
        txid,
        amount_sats: request.satoshis,
        block_height: null,
        confirmations: 0,
        fees_sats: 1,
        size_bytes: rawTx.length / 2,
        metadata: {
          memo: request.memo,
          derivationPrefix: request.derivationPrefix,
          derivationSuffix: request.derivationSuffix,
        },
        wallet_from_address: this.address,
        wallet_to_address: recipientAddress,
        verified_on_chain: false,
      });

      console.log(`[Wallet] REAL BSV payment broadcasted: ${txid} (${request.satoshis} sats)`);

      return {
        txid,
        tx: new Uint8Array(Buffer.from(rawTx, 'hex')),
        senderIdentityKey: this.identityKey,
        derivationPrefix: request.derivationPrefix,
        derivationSuffix: request.derivationSuffix,
        outputIndex: 0,
      };
    } catch (error) {
      throw new Error(`Direct payment failed: ${(error as Error).message}`);
    }
  }

  /**
   * Receive a direct payment from another identity
   * Internalizes the payment into wallet balance
   *
   * NOTE: This is a simplified implementation for MVP
   * Production version should use WalletClient.internalizeAction()
   */
  async receiveDirectPayment(payment: IncomingPayment): Promise<void> {
    try {
      const tx = payment.tx instanceof Uint8Array ? Array.from(payment.tx) : payment.tx;

      // TODO: Internalize using WalletClient.internalizeAction()
      // For MVP, we just log the receipt
      console.log(`[Wallet] Received payment from ${payment.senderIdentityKey.substring(0, 16)}...`);
      console.log(`[Wallet] Amount: ${tx.length} bytes, Output: ${payment.outputIndex}`);

      // In production:
      // await walletClient.internalizeAction({
      //   tx,
      //   outputs: [{
      //     outputIndex: payment.outputIndex,
      //     protocol: 'wallet payment',
      //     paymentRemittance: {
      //       senderIdentityKey: payment.senderIdentityKey,
      //       derivationPrefix: payment.derivationPrefix,
      //       derivationSuffix: payment.derivationSuffix,
      //     },
      //   }],
      //   description: `Payment from ${payment.senderIdentityKey.substring(0, 20)}...`,
      //   labels: ['direct_payment'],
      // });

    } catch (error) {
      throw new Error(`Failed to receive direct payment: ${(error as Error).message}`);
    }
  }

  /**
   * Derive a public key using BRC-29 protocol
   *
   * NOTE: This is a simplified implementation for MVP
   * Production version should use WalletClient.getPublicKey()
   */
  private async derivePublicKey(
    protocolID: [number, string],
    keyID: string,
    counterparty: string,
    forSelf: boolean
  ): Promise<string> {
    // TODO: Implement full BRC-29 key derivation
    // For MVP, we return the counterparty key directly
    // In production, this would use proper key derivation with ECDH
    return counterparty;
  }

  /**
   * Get balance from WhatsOnChain API
   */
  async getBalance(): Promise<number> {
    const balance = await this.txBuilder.getBalance();
    return balance.confirmed + balance.unconfirmed;
  }
}
