/**
 * Risk Oracle - AIS Stream Client
 * WebSocket connection to aisstream.io for real-time vessel positions
 */

import WebSocket from 'ws';
import { VesselPosition, AIS_BOUNDING_BOXES } from '@hormuz/shared';

export interface AISMessage {
  MessageType: string;
  MetaData?: {
    ShipName?: string;
    MMSI?: string;
    latitude?: number;
    longitude?: number;
    time_utc?: string;
  };
  Message?: {
    PositionReport?: {
      Cog?: number;    // Course over ground
      Sog?: number;    // Speed over ground
      TrueHeading?: number;
      Latitude?: number;
      Longitude?: number;
    };
  };
}

export type AISEventHandler = (position: VesselPosition) => void;

export class AISClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private isConnected = false;
  private positionBuffer: Map<string, VesselPosition> = new Map();
  private maxBufferSize = 1000;
  private eventHandlers: AISEventHandler[] = [];

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Connect to AIS Stream WebSocket
   */
  connect(): void {
    if (this.isConnected) {
      console.log('[AIS] Already connected');
      return;
    }

    console.log('[AIS] Connecting to aisstream.io...');

    this.ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

    this.ws.on('open', () => {
      console.log('[AIS] Connected to aisstream.io');
      this.isConnected = true;
      this.subscribe();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message: AISMessage = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('[AIS] Error parsing message:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('[AIS] WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('[AIS] Connection closed, reconnecting in 5s...');
      this.isConnected = false;
      setTimeout(() => this.connect(), 5000);
    });
  }

  /**
   * Subscribe to all risk zone bounding boxes
   */
  private subscribe(): void {
    if (!this.ws || !this.isConnected) return;

    const subscriptionMessage = {
      APIKey: this.apiKey,
      BoundingBoxes: AIS_BOUNDING_BOXES.map(zone => zone.boundingBox),
      FilterMessageTypes: ['PositionReport'],
    };

    console.log('[AIS] Subscribing to', AIS_BOUNDING_BOXES.length, 'zones');
    this.ws.send(JSON.stringify(subscriptionMessage));
  }

  /**
   * Handle incoming AIS message
   */
  private handleMessage(message: AISMessage): void {
    if (message.MessageType !== 'PositionReport') return;
    if (!message.MetaData || !message.Message?.PositionReport) return;

    const meta = message.MetaData;
    const pos = message.Message.PositionReport;

    // Validate required fields
    if (!meta.MMSI || pos.Latitude === undefined || pos.Longitude === undefined) {
      return;
    }

    const position: VesselPosition = {
      mmsi: meta.MMSI,
      lat: pos.Latitude,
      lon: pos.Longitude,
      speed: pos.Sog || 0,
      course: pos.Cog || 0,
      heading: pos.TrueHeading || 0,
      timestamp: meta.time_utc ? new Date(meta.time_utc).getTime() : Date.now(),
      vesselName: meta.ShipName,
    };

    // Add to buffer
    this.positionBuffer.set(position.mmsi, position);

    // Trim buffer if too large
    if (this.positionBuffer.size > this.maxBufferSize) {
      const firstKey = this.positionBuffer.keys().next().value;
      if (firstKey) {
        this.positionBuffer.delete(firstKey);
      }
    }

    // Emit to event handlers
    this.eventHandlers.forEach(handler => handler(position));

    // Log
    console.log(
      `[AIS] Position: MMSI ${position.mmsi} at (${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}) - ${position.speed.toFixed(1)} kts`
    );
  }

  /**
   * Register event handler for position updates
   */
  onPosition(handler: AISEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Get position for specific MMSI
   */
  getPosition(mmsi: string): VesselPosition | undefined {
    return this.positionBuffer.get(mmsi);
  }

  /**
   * Get all positions
   */
  getAllPositions(): VesselPosition[] {
    return Array.from(this.positionBuffer.values());
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.positionBuffer.size;
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}
