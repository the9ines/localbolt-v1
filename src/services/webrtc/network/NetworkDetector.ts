
type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'unknown';
type ConnectionSpeed = 'slow' | 'medium' | 'fast';

export interface NetworkInfo {
  type: NetworkType;
  speed: ConnectionSpeed;
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'unknown';
  downlink: number;
  rtt: number;
}

export class NetworkDetector {
  private connection: any;
  private onNetworkChange?: (info: NetworkInfo) => void;

  constructor(onNetworkChange?: (info: NetworkInfo) => void) {
    this.onNetworkChange = onNetworkChange;
    this.connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
    
    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (this.connection) {
      console.log('[NETWORK] Setting up network change listeners');
      this.connection.addEventListener('change', () => {
        const info = this.getNetworkInfo();
        console.log('[NETWORK] Connection changed:', info);
        if (this.onNetworkChange) {
          this.onNetworkChange(info);
        }
      });
    }
  }

  getNetworkInfo(): NetworkInfo {
    const info: NetworkInfo = {
      type: 'unknown',
      speed: 'medium',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0
    };

    if (this.connection) {
      info.type = this.detectNetworkType();
      info.effectiveType = this.connection.effectiveType || 'unknown';
      info.downlink = this.connection.downlink || 0;
      info.rtt = this.connection.rtt || 0;
      info.speed = this.calculateSpeed(info);
    } else {
      // Fallback detection using performance API
      info.type = this.detectNetworkTypeFallback();
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (timing) {
        info.rtt = timing.responseStart - timing.requestStart;
        info.downlink = (timing.transferSize * 8) / (timing.responseEnd - timing.responseStart);
        info.speed = this.calculateSpeed(info);
      }
    }

    return info;
  }

  private detectNetworkType(): NetworkType {
    if (!this.connection) return 'unknown';

    const type = this.connection.type;
    if (type === 'wifi') return 'wifi';
    if (type === 'cellular') return 'cellular';
    if (type === 'ethernet') return 'ethernet';
    return 'unknown';
  }

  private detectNetworkTypeFallback(): NetworkType {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('wifi')) return 'wifi';
    if (userAgent.includes('cellular')) return 'cellular';
    return 'unknown';
  }

  private calculateSpeed(info: Partial<NetworkInfo>): ConnectionSpeed {
    if (info.effectiveType === '4g' || info.effectiveType === '5g') {
      return 'fast';
    }
    if (info.effectiveType === '3g') {
      return 'medium';
    }
    if (info.downlink && info.downlink > 5) {
      return 'fast';
    }
    if (info.downlink && info.downlink > 2) {
      return 'medium';
    }
    return 'slow';
  }
}
