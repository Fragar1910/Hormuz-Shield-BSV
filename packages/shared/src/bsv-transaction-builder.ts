/**
 * BSV Transaction Builder
 * =======================
 * Real BSV transaction creation and broadcasting
 * Uses @bsv/sdk for UTXO management and ARC for broadcasting
 */

import {
  PrivateKey,
  Transaction,
  P2PKH,
  Script,
  OP,
  Utils,
  ARC,
} from '@bsv/sdk';
import * as https from 'https';
import * as http from 'http';

export interface TransactionInput {
  txid: string;
  vout: number;
  satoshis: number;
  script: string;
}

export interface TransactionOutput {
  address?: string;
  satoshis: number;
  script?: string;
}

export interface BroadcastResult {
  txid: string;
  status: 'success' | 'error';
  message?: string;
  endpoint?: string; // Which endpoint was used
}

export type BroadcastEndpoint = 'whatsonchain' | 'arc' | 'gorillapool';

export interface BroadcastConfig {
  endpoints?: BroadcastEndpoint[]; // Priority order
  arcUrl?: string;
  arcApiKey?: string;
}

/**
 * Real BSV Transaction Builder
 */
export class BSVTransactionBuilder {
  private privateKey: PrivateKey;
  private address: string;
  private network: 'main' | 'test';
  private broadcastEndpoints: BroadcastEndpoint[];
  private arcUrl: string;
  private arcApiKey?: string;

  constructor(config: {
    privateKeyWif: string;
    network: 'main' | 'test';
    broadcastEndpoints?: BroadcastEndpoint[];
    arcUrl?: string;
    arcApiKey?: string;
  }) {
    this.privateKey = PrivateKey.fromWif(config.privateKeyWif);
    this.network = config.network;

    // Default: WhatsOnChain (free, no API key) → ARC → GorillaPool
    this.broadcastEndpoints = config.broadcastEndpoints || ['whatsonchain', 'arc', 'gorillapool'];
    this.arcUrl = config.arcUrl || 'https://api.taal.com/arc';
    this.arcApiKey = config.arcApiKey;

    const publicKey = this.privateKey.toPublicKey();
    this.address = publicKey
      .toAddress(config.network === 'test' ? 'testnet' : undefined)
      .toString();

    console.log(`[BSVTxBuilder] Broadcast endpoints (priority order): ${this.broadcastEndpoints.join(' → ')}`);
  }

  /**
   * Get UTXOs for this address from WhatsOnChain API
   */
  async getUTXOs(): Promise<TransactionInput[]> {
    const wocBaseUrl =
      this.network === 'test'
        ? 'https://api.whatsonchain.com/v1/bsv/test'
        : 'https://api.whatsonchain.com/v1/bsv/main';

    const url = `${wocBaseUrl}/address/${this.address}/unspent`;

    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const utxos = JSON.parse(data);
              if (!Array.isArray(utxos)) {
                reject(new Error('Invalid UTXO response'));
                return;
              }

              const inputs: TransactionInput[] = utxos.map((utxo: any) => ({
                txid: utxo.tx_hash,
                vout: utxo.tx_pos,
                satoshis: utxo.value,
                script: utxo.script || '',
              }));

              resolve(inputs);
            } catch (error) {
              reject(error);
            }
          });
        })
        .on('error', reject);
    });
  }

  /**
   * Create and sign a simple P2PKH payment transaction
   */
  async createPaymentTransaction(
    recipientAddress: string,
    amountSats: number,
    memo?: string
  ): Promise<{ tx: Transaction; txid: string; rawTx: string }> {
    // Get UTXOs
    const utxos = await this.getUTXOs();
    if (utxos.length === 0) {
      throw new Error('No UTXOs available. Please fund the wallet.');
    }

    // Calculate fees (1 sat/byte estimate)
    const estimatedSize = 180 + (memo ? memo.length + 10 : 0);
    const feeSats = Math.max(1, Math.ceil(estimatedSize / 2));

    // Select UTXOs (simple: use first UTXO that covers amount + fees)
    const requiredSats = amountSats + feeSats;
    let selectedUTXO: TransactionInput | null = null;

    for (const utxo of utxos) {
      if (utxo.satoshis >= requiredSats) {
        selectedUTXO = utxo;
        break;
      }
    }

    if (!selectedUTXO) {
      // Try combining multiple UTXOs
      let total = 0;
      const selectedUTXOs: TransactionInput[] = [];
      for (const utxo of utxos) {
        selectedUTXOs.push(utxo);
        total += utxo.satoshis;
        if (total >= requiredSats) {
          break;
        }
      }

      if (total < requiredSats) {
        throw new Error(
          `Insufficient funds. Need ${requiredSats} sats, have ${total} sats`
        );
      }

      // For simplicity in MVP, use first sufficient UTXO only
      selectedUTXO = selectedUTXOs[0];
    }

    // Create transaction
    const tx = new Transaction();

    // Add input
    tx.addInput({
      sourceTXID: selectedUTXO.txid,
      sourceOutputIndex: selectedUTXO.vout,
      unlockingScriptTemplate: new P2PKH().unlock(this.privateKey),
    });

    // Add payment output
    tx.addOutput({
      lockingScript: new P2PKH().lock(recipientAddress),
      change: false,
      satoshis: amountSats,
    });

    // Add OP_RETURN memo if provided
    if (memo) {
      const memoScript = new Script()
        .writeOpCode(OP.OP_FALSE)
        .writeOpCode(OP.OP_RETURN)
        .writeBin(Utils.toArray(memo, 'utf8'));

      tx.addOutput({
        lockingScript: memoScript,
        satoshis: 0,
        change: false,
      });
    }

    // Add change output
    const changeSats = selectedUTXO.satoshis - amountSats - feeSats;
    if (changeSats > 0) {
      tx.addOutput({
        lockingScript: new P2PKH().lock(this.address),
        change: true,
        satoshis: changeSats,
      });
    }

    // Sign transaction
    await tx.sign();

    // Compute TXID
    await tx.fee();
    await tx.verify();
    const txid = await tx.id('hex');
    const rawTx = tx.toHex();

    return { tx, txid, rawTx };
  }

  /**
   * Broadcast via WhatsOnChain (FREE, no API key required)
   */
  private async broadcastViaWhatsOnChain(rawTx: string): Promise<BroadcastResult> {
    const wocBaseUrl = this.network === 'test'
      ? 'https://api.whatsonchain.com/v1/bsv/test'
      : 'https://api.whatsonchain.com/v1/bsv/main';

    const url = `${wocBaseUrl}/tx/raw`;
    const postData = JSON.stringify({ txhex: rawTx });

    return new Promise((resolve, reject) => {
      https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode === 200 || res.statusCode === 201) {
              // WhatsOnChain returns just the TXID as a string
              const txid = JSON.parse(data);
              resolve({
                txid: typeof txid === 'string' ? txid : txid.txid,
                status: 'success',
                endpoint: 'whatsonchain',
                message: 'Broadcasted via WhatsOnChain',
              });
            } else {
              reject(new Error(`WhatsOnChain error: ${data}`));
            }
          } catch (error) {
            reject(new Error(`WhatsOnChain parse error: ${(error as Error).message}`));
          }
        });
      }).on('error', reject).end(postData);
    });
  }

  /**
   * Broadcast via ARC (TAAL)
   */
  private async broadcastViaARC(rawTx: string): Promise<BroadcastResult> {
    const url = new URL(`${this.arcUrl}/v1/tx`);
    const postData = JSON.stringify({ rawTx });

    const options: http.RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(this.arcApiKey && { 'Authorization': `Bearer ${this.arcApiKey}` }),
      },
    };

    return new Promise((resolve, reject) => {
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (res.statusCode === 200 || res.statusCode === 201) {
              resolve({
                txid: response.txid || response.txId,
                status: 'success',
                endpoint: 'arc',
                message: 'Broadcasted via ARC',
              });
            } else {
              reject(new Error(response.detail || response.error || 'ARC broadcast failed'));
            }
          } catch (error) {
            reject(new Error(`ARC parse error: ${(error as Error).message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Broadcast via GorillaPool
   */
  private async broadcastViaGorillaPool(rawTx: string): Promise<BroadcastResult> {
    const url = 'https://mapi.gorillapool.io/mapi/tx';
    const postData = JSON.stringify({ rawtx: rawTx });

    return new Promise((resolve, reject) => {
      https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (res.statusCode === 200 || res.statusCode === 201) {
              resolve({
                txid: response.txid || response.txId,
                status: 'success',
                endpoint: 'gorillapool',
                message: 'Broadcasted via GorillaPool',
              });
            } else {
              reject(new Error(response.error || 'GorillaPool broadcast failed'));
            }
          } catch (error) {
            reject(new Error(`GorillaPool parse error: ${(error as Error).message}`));
          }
        });
      }).on('error', reject).end(postData);
    });
  }

  /**
   * Broadcast transaction with automatic fallback
   * Tries endpoints in priority order until one succeeds
   */
  async broadcastTransaction(rawTx: string): Promise<BroadcastResult> {
    const errors: string[] = [];

    for (const endpoint of this.broadcastEndpoints) {
      try {
        console.log(`[BSVTxBuilder] Trying broadcast via ${endpoint}...`);

        let result: BroadcastResult;

        switch (endpoint) {
          case 'whatsonchain':
            result = await this.broadcastViaWhatsOnChain(rawTx);
            break;
          case 'arc':
            if (!this.arcApiKey) {
              console.log(`[BSVTxBuilder] Skipping ARC (no API key)`);
              continue;
            }
            result = await this.broadcastViaARC(rawTx);
            break;
          case 'gorillapool':
            if (this.network === 'test') {
              console.log(`[BSVTxBuilder] Skipping GorillaPool (testnet not supported)`);
              continue;
            }
            result = await this.broadcastViaGorillaPool(rawTx);
            break;
          default:
            throw new Error(`Unknown endpoint: ${endpoint}`);
        }

        console.log(`[BSVTxBuilder] ✅ Broadcast successful via ${endpoint}: ${result.txid}`);
        return result;

      } catch (error) {
        const errorMsg = `${endpoint}: ${(error as Error).message}`;
        errors.push(errorMsg);
        console.log(`[BSVTxBuilder] ❌ ${endpoint} failed: ${(error as Error).message}`);
        // Continue to next endpoint
      }
    }

    // All endpoints failed
    throw new Error(`All broadcast endpoints failed:\n${errors.join('\n')}`);
  }

  /**
   * Create and broadcast a payment in one step
   */
  async sendPayment(
    recipientAddress: string,
    amountSats: number,
    memo?: string
  ): Promise<{ txid: string; rawTx: string }> {
    // Create transaction
    const { txid, rawTx } = await this.createPaymentTransaction(
      recipientAddress,
      amountSats,
      memo
    );

    // Broadcast
    const result = await this.broadcastTransaction(rawTx);

    if (result.status === 'error') {
      throw new Error(`Broadcast failed: ${result.message}`);
    }

    console.log(`[BSV] Transaction broadcasted: ${txid}`);
    return { txid, rawTx };
  }

  /**
   * Get balance from WhatsOnChain
   */
  async getBalance(): Promise<{ confirmed: number; unconfirmed: number }> {
    const wocBaseUrl =
      this.network === 'test'
        ? 'https://api.whatsonchain.com/v1/bsv/test'
        : 'https://api.whatsonchain.com/v1/bsv/main';

    const url = `${wocBaseUrl}/address/${this.address}/balance`;

    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const balance = JSON.parse(data);
              resolve({
                confirmed: balance.confirmed || 0,
                unconfirmed: balance.unconfirmed || 0,
              });
            } catch (error) {
              reject(error);
            }
          });
        })
        .on('error', reject);
    });
  }

  /**
   * Get address
   */
  getAddress(): string {
    return this.address;
  }
}
