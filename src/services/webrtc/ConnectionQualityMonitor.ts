
export interface ConnectionQualityMetrics {
  rtt?: number;              // Round trip time in ms
  packetLoss?: number;       // Packet loss percentage
  bandwidth?: number;        // Available bandwidth in bits/s
  currentQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  timestamp: number;
}

export class ConnectionQualityMonitor {
  private statsInterval?: NodeJS.Timeout;
  private readonly STATS_INTERVAL = 2000; // Check every 2 seconds
  private readonly RTT_THRESHOLD = {
    excellent: 100,    // < 100ms
    good: 200,        // < 200ms
    fair: 500,        // < 500ms
    poor: 1000        // < 1000ms
    // Above 1000ms is critical
  };

  constructor(
    private onQualityChange: (metrics: ConnectionQualityMetrics) => void,
    private onError: (error: WebRTCError) => void
  ) {}

  async startMonitoring(peerConnection: RTCPeerConnection) {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = setInterval(async () => {
      try {
        const stats = await peerConnection.getStats();
        const metrics = this.processStats(stats);
        this.onQualityChange(metrics);
      } catch (error) {
        console.error('[QUALITY] Failed to get connection stats:', error);
      }
    }, this.STATS_INTERVAL);
  }

  private processStats(stats: RTCStatsReport): ConnectionQualityMetrics {
    let rtt: number | undefined;
    let packetLoss: number | undefined;
    let bandwidth: number | undefined;

    stats.forEach(stat => {
      if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        rtt = stat.currentRoundTripTime ? stat.currentRoundTripTime * 1000 : undefined;
      }
      if (stat.type === 'inbound-rtp') {
        packetLoss = stat.packetsLost ? (stat.packetsLost / stat.packetsReceived) * 100 : undefined;
      }
      if (stat.type === 'media-source') {
        bandwidth = stat.bitrate;
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

  private calculateQuality(rtt?: number, packetLoss?: number): ConnectionQualityMetrics['currentQuality'] {
    if (!rtt && !packetLoss) return 'fair';

    if (rtt) {
      if (rtt < this.RTT_THRESHOLD.excellent) return 'excellent';
      if (rtt < this.RTT_THRESHOLD.good) return 'good';
      if (rtt < this.RTT_THRESHOLD.fair) return 'fair';
      if (rtt < this.RTT_THRESHOLD.poor) return 'poor';
      return 'critical';
    }

    // Fallback to packet loss if RTT is not available
    if (packetLoss) {
      if (packetLoss < 1) return 'excellent';
      if (packetLoss < 2.5) return 'good';
      if (packetLoss < 5) return 'fair';
      if (packetLoss < 10) return 'poor';
      return 'critical';
    }

    return 'fair';
  }

  stop() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = undefined;
    }
  }
}
