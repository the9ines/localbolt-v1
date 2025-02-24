
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { ConnectionQualityMetrics } from '../ConnectionQualityMonitor';

export class ConnectionQualityService {
  private monitoringInterval?: NodeJS.Timeout;
  private qualityChangeCallback?: (metrics: ConnectionQualityMetrics) => void;

  constructor(private peerConnection: RTCPeerConnection | null) {}

  startMonitoring(callback: (metrics: ConnectionQualityMetrics) => void) {
    this.qualityChangeCallback = callback;
    
    if (!this.peerConnection) {
      console.warn('[QUALITY] No peer connection available for monitoring');
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const stats = await this.peerConnection!.getStats();
        const metrics = this.processConnectionStats(stats);
        if (this.qualityChangeCallback) {
          this.qualityChangeCallback(metrics);
        }
      } catch (error) {
        console.error('[QUALITY] Failed to get connection stats:', error);
      }
    }, 2000);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.qualityChangeCallback = undefined;
  }

  private processConnectionStats(stats: RTCStatsReport): ConnectionQualityMetrics {
    let rtt = 0;
    let packetLoss = 0;
    let bandwidth = 0;

    stats.forEach(stat => {
      if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        rtt = stat.currentRoundTripTime ? stat.currentRoundTripTime * 1000 : 0;
      }
      if (stat.type === 'inbound-rtp') {
        packetLoss = stat.packetsLost ? (stat.packetsLost / stat.packetsReceived) * 100 : 0;
      }
      if (stat.type === 'media-source') {
        bandwidth = stat.bitrate || 0;
      }
    });

    return {
      rtt,
      packetLoss,
      bandwidth,
      currentQuality: this.calculateQuality(rtt, packetLoss),
      timestamp: Date.now()
    };
  }

  private calculateQuality(rtt: number, packetLoss: number): ConnectionQualityMetrics['currentQuality'] {
    if (rtt < 50 && packetLoss < 0.5) return 'excellent';
    if (rtt < 150 && packetLoss < 2) return 'good';
    if (rtt < 300 && packetLoss < 5) return 'fair';
    if (rtt < 500 && packetLoss < 10) return 'poor';
    return 'critical';
  }
}
