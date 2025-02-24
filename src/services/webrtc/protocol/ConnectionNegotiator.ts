
import { WebRTCError } from '@/types/webrtc-errors';

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

  async selectBestTransport(peerId: string): Promise<TransportMode> {
    const peer = this.discoveredPeers.get(peerId);
    
    if (!navigator.onLine) {
      return TransportMode.OFFLINE;
    }

    if (peer && await this.isLocalNetworkAvailable(peer)) {
      console.log('[NEGOTIATOR] Local network available for peer:', peerId);
      return TransportMode.LOCAL;
    }

    console.log('[NEGOTIATOR] Falling back to internet transport for peer:', peerId);
    return TransportMode.INTERNET;
  }

  private async isLocalNetworkAvailable(peer: PeerInfo): Promise<boolean> {
    // Check if both peers support mDNS and are on the same network
    if (!peer.capabilities.mdns) {
      return false;
    }

    // Check if the peer was discovered recently (within last 30 seconds)
    const isRecent = (Date.now() - peer.timestamp) < 30000;
    
    // Additional check for local network connectivity
    try {
      const rtcPeerConnection = new RTCPeerConnection({
        iceServers: [],  // Empty array forces local candidates only
        iceTransportPolicy: 'relay'
      });
      
      const candidates = await this.gatherLocalCandidates(rtcPeerConnection);
      rtcPeerConnection.close();
      
      return candidates.some(candidate => 
        candidate.type === 'host' && 
        !candidate.address.includes('127.0.0.1')
      ) && isRecent;
    } catch (error) {
      console.warn('[NEGOTIATOR] Error checking local network:', error);
      return false;
    }
  }

  private async gatherLocalCandidates(pc: RTCPeerConnection): Promise<RTCIceCandidate[]> {
    return new Promise((resolve) => {
      const candidates: RTCIceCandidate[] = [];
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push(event.candidate);
        } else {
          resolve(candidates);
        }
      };

      pc.createDataChannel('probe');
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(error => {
          console.error('[NEGOTIATOR] Error gathering candidates:', error);
          resolve([]);
        });
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
