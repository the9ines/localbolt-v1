
export enum TransportMode {
  LOCAL = 'local',
  INTERNET = 'internet',
  OFFLINE = 'offline'
}

export interface PeerInfo {
  id: string;
  capabilities: {
    mdns: boolean;
    webrtc: boolean;
    encryption: string[];
  };
  networkType: TransportMode;
  timestamp: number;
}

export class ConnectionNegotiator {
  private discoveredPeers: Map<string, PeerInfo> = new Map();
  
  constructor() {
    this.setupDiscoveryListener();
  }

  private setupDiscoveryListener() {
    window.addEventListener('localbolt-peer-discovered', ((event: CustomEvent<PeerInfo>) => {
      this.handlePeerDiscovered(event.detail);
    }) as EventListener);
  }

  private handlePeerDiscovered(peer: PeerInfo) {
    console.log('[NEGOTIATOR] New peer discovered:', peer);
    this.discoveredPeers.set(peer.id, {
      ...peer,
      timestamp: Date.now()
    });
  }

  getCurrentPeers(): PeerInfo[] {
    // Clean up old peers (older than 30 seconds)
    const now = Date.now();
    for (const [id, peer] of this.discoveredPeers.entries()) {
      if (now - peer.timestamp > 30000) {
        this.discoveredPeers.delete(id);
      }
    }
    return Array.from(this.discoveredPeers.values());
  }
}
