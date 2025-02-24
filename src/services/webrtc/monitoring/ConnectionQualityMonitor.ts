
import type { ConnectionQualityMetrics, ConnectionQuality } from '../types/connection-quality';
import { WebRTCError } from '@/types/webrtc-errors';

export class ConnectionQualityMonitor {
  private metrics: ConnectionQualityMetrics = {
    rtt: 0,
    packetLoss: 0,
    bandwidth: 0,
    timestamp: Date.now()
  };
  
  private statsInterval: NodeJS.Timer | null = null;
  private readonly MONITORING_INTERVAL = 2000; // 2 seconds
  private readonly RTT_THRESHOLD_GOOD = 100; // ms
  private readonly RTT_THRESHOLD_FAIR = 300; // ms
  private readonly PACKET_LOSS_THRESHOLD = 0.02; // 2%

  constructor(
    private peerConnection: RTCPeerConnection,
    private onQualityChange?: (quality: ConnectionQuality) => void,
    private onMetricsUpdate?: (metrics: ConnectionQualityMetrics) => void
  ) {}

  startMonitoring(): void {
    if (this.statsInterval) return;

    console.log('[MONITOR] Starting connection quality monitoring');
    this.statsInterval = setInterval(() => this.gatherMetrics(), this.MONITORING_INTERVAL);
  }

  stopMonitoring(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
      console.log('[MONITOR] Stopped connection quality monitoring');
    }
  }

  private async gatherMetrics(): Promise<void> {
    try {
      const stats = await this.peerConnection.getStats();
      const newMetrics: ConnectionQualityMetrics = {
        rtt: 0,
        packetLoss: 0,
        bandwidth: 0,
        timestamp: Date.now()
      };

      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          newMetrics.rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
        }
        
        if (report.type === 'inbound-rtp') {
          const packetsLost = report.packetsLost || 0;
          const packetsReceived = report.packetsReceived || 0;
          newMetrics.packetLoss = packetsReceived > 0 
            ? packetsLost / (packetsLost + packetsReceived)
            : 0;
        }

        if (report.type === 'data-channel') {
          newMetrics.bandwidth = report.bytesSent 
            ? (report.bytesSent * 8) / (report.timestamp - this.metrics.timestamp)
            : 0;
        }
      });

      this.metrics = newMetrics;
      
      const quality = this.calculateQuality(newMetrics);
      console.log('[MONITOR] Connection quality:', quality, 'Metrics:', newMetrics);
      
      if (this.onQualityChange) {
        this.onQualityChange(quality);
      }
      
      if (this.onMetricsUpdate) {
        this.onMetricsUpdate(newMetrics);
      }
    } catch (error) {
      console.error('[MONITOR] Failed to gather metrics:', error);
      throw new WebRTCError('Failed to monitor connection quality', error);
    }
  }

  private calculateQuality(metrics: ConnectionQualityMetrics): ConnectionQuality {
    if (metrics.rtt < this.RTT_THRESHOLD_GOOD && metrics.packetLoss < this.PACKET_LOSS_THRESHOLD / 2) {
      return 'excellent';
    } else if (metrics.rtt < this.RTT_THRESHOLD_FAIR && metrics.packetLoss < this.PACKET_LOSS_THRESHOLD) {
      return 'good';
    } else if (metrics.rtt < this.RTT_THRESHOLD_FAIR * 2) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  getMetrics(): ConnectionQualityMetrics {
    return { ...this.metrics };
  }
}
