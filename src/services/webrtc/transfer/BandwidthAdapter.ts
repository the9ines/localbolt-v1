
import type { ConnectionQuality, ConnectionQualityMetrics } from '../types/connection-quality';

export class BandwidthAdapter {
  private readonly BASE_CHUNK_SIZE = 16384; // 16KB base chunk size
  private readonly MIN_CHUNK_SIZE = 8192; // 8KB minimum
  private readonly MAX_CHUNK_SIZE = 65536; // 64KB maximum
  
  private currentChunkSize: number;
  private lastQuality: ConnectionQuality = 'good';
  private lastMetrics: ConnectionQualityMetrics | null = null;

  constructor() {
    this.currentChunkSize = this.BASE_CHUNK_SIZE;
  }

  updateQuality(quality: ConnectionQuality, metrics: ConnectionQualityMetrics): void {
    console.log('[BANDWIDTH] Updating quality:', quality, 'Metrics:', metrics);
    
    this.lastQuality = quality;
    this.lastMetrics = metrics;

    // Adjust chunk size based on connection quality
    switch (quality) {
      case 'excellent':
        this.increaseChunkSize(1.5);
        break;
      case 'good':
        this.increaseChunkSize(1.2);
        break;
      case 'fair':
        this.decreaseChunkSize(0.8);
        break;
      case 'poor':
        this.decreaseChunkSize(0.5);
        break;
    }

    // Fine-tune based on RTT and packet loss
    if (metrics.packetLoss > 0.01) {
      this.decreaseChunkSize(0.9);
    }
    if (metrics.rtt > 200) {
      this.decreaseChunkSize(0.95);
    }

    console.log('[BANDWIDTH] Adjusted chunk size:', this.currentChunkSize);
  }

  private increaseChunkSize(factor: number): void {
    const newSize = Math.min(
      this.currentChunkSize * factor,
      this.MAX_CHUNK_SIZE
    );
    this.currentChunkSize = Math.floor(newSize);
  }

  private decreaseChunkSize(factor: number): void {
    const newSize = Math.max(
      this.currentChunkSize * factor,
      this.MIN_CHUNK_SIZE
    );
    this.currentChunkSize = Math.floor(newSize);
  }

  getCurrentChunkSize(): number {
    return this.currentChunkSize;
  }

  getTransferRate(): number {
    if (!this.lastMetrics) return this.BASE_CHUNK_SIZE;
    return this.currentChunkSize * (1000 / Math.max(this.lastMetrics.rtt, 50));
  }

  shouldThrottle(): boolean {
    return this.lastQuality === 'poor' || (this.lastMetrics?.packetLoss || 0) > 0.05;
  }

  reset(): void {
    this.currentChunkSize = this.BASE_CHUNK_SIZE;
    this.lastQuality = 'good';
    this.lastMetrics = null;
  }
}
