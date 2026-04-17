/**
 * HormuzShield - Utility Functions
 */

/**
 * Format satoshis to BSV
 */
export function satsToBsv(sats: number): string {
  return (sats / 100_000_000).toFixed(8);
}

/**
 * Format satoshis to USD (approximate)
 */
export function satsToUsd(sats: number, bsvUsdPrice: number = 50): string {
  const bsv = sats / 100_000_000;
  return (bsv * bsvUsdPrice).toFixed(2);
}

/**
 * Convert USD to satoshis
 */
export function usdToSats(usd: number, bsvUsdPrice: number = 50): number {
  const bsv = usd / bsvUsdPrice;
  return Math.round(bsv * 100_000_000);
}

/**
 * Format timestamp to ISO string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Format timestamp to readable date/time
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Sleep for ms milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        const backoff = delayMs * Math.pow(2, attempt - 1);
        console.warn(`Attempt ${attempt} failed, retrying in ${backoff}ms...`);
        await sleep(backoff);
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate percentage
 */
export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Check if value is within range
 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Calculate moving average
 */
export function movingAverage(values: number[], window: number = 5): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-window);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / slice.length;
}

/**
 * Parse BSV transaction ID (validate format)
 */
export function isValidTxid(txid: string): boolean {
  return /^[a-f0-9]{64}$/i.test(txid);
}

/**
 * Parse MMSI (Maritime Mobile Service Identity)
 */
export function isValidMmsi(mmsi: string): boolean {
  return /^\d{9}$/.test(mmsi);
}

/**
 * Generate random MMSI for simulation
 */
export function generateMmsi(): string {
  // US vessels: 338XXXXXX, 366XXXXXX, 367XXXXXX, 368XXXXXX, 369XXXXXX
  const prefix = [338, 366, 367, 368, 369][Math.floor(Math.random() * 5)];
  const suffix = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return `${prefix}${suffix}`;
}

/**
 * Convert knots to km/h
 */
export function knotsToKmh(knots: number): number {
  return knots * 1.852;
}

/**
 * Convert km/h to knots
 */
export function kmhToKnots(kmh: number): number {
  return kmh / 1.852;
}

/**
 * Calculate bearing between two points
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = toRadians(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);
  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: any): boolean {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === 'string') return obj.length === 0;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}
