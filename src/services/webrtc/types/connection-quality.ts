
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface ConnectionQualityMetrics {
  rtt: number;          // Round-trip time in milliseconds
  packetLoss: number;   // Packet loss ratio (0-1)
  bandwidth: number;    // Available bandwidth in bits per second
  timestamp: number;    // Timestamp of the measurement
}
