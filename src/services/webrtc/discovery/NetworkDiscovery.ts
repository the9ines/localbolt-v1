
import { SignalingService } from '../SignalingService';
import type { DiscoveredPeer, NetworkType, PeerInfo } from '../types/discovery';
import { WebRTCError } from '@/types/webrtc-errors';

export class NetworkDiscovery {
  private peers: Map<string, DiscoveredPeer> = new Map();
  private mdnsSupported: boolean = false;

  constructor(
    private signalingService: SignalingService,
    private localPeerInfo: PeerInfo,
    private onPeerDiscovered?: (peer: DiscoveredPeer) => void
  ) {
    this.checkMdnsSupport();
  }

  private async checkMdnsSupport(): Promise<void> {
    try {
      const rtc = new RTCPeerConnection({
        iceServers: [],
        iceTransportPolicy: 'all'
      });

      const offer = await rtc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      this.mdnsSupported = offer.sdp?.includes('mdns') || false;
      rtc.close();
      
      console.log('[DISCOVERY] mDNS support:', this.mdnsSupported);
    } catch (error) {
      console.warn('[DISCOVERY] Failed to check mDNS support:', error);
      this.mdnsSupported = false;
    }
  }

  async startDiscovery(): Promise<void> {
    if (this.mdnsSupported) {
      await this.startLocalDiscovery();
    }
    
    // Always start signaling as fallback
    await this.startSignalingDiscovery();
  }

  private async startLocalDiscovery(): Promise<void> {
    if (!this.mdnsSupported) {
      console.log('[DISCOVERY] mDNS not supported, skipping local discovery');
      return;
    }

    try {
      console.log('[DISCOVERY] Starting local peer discovery');
      // Implementation of local mDNS discovery will go here
      // This is a placeholder for now as we need browser APIs to mature
      
      // For testing, we'll simulate finding a local peer
      const mockLocalPeer: DiscoveredPeer = {
        deviceId: 'local-' + Math.random().toString(36).substring(7),
        capabilities: {
          mdns: true,
          webrtc: true,
          encryption: ['tweetnacl']
        },
        networkType: 'local',
        timestamp: Date.now()
      };

      this.handleDiscoveredPeer(mockLocalPeer);
    } catch (error) {
      console.error('[DISCOVERY] Local discovery error:', error);
      throw new WebRTCError('Local discovery failed', error);
    }
  }

  private async startSignalingDiscovery(): Promise<void> {
    console.log('[DISCOVERY] Starting signaling discovery');
    // Continue using existing SignalingService
    // This is already implemented and working
  }

  private handleDiscoveredPeer(peer: DiscoveredPeer): void {
    if (!this.peers.has(peer.deviceId)) {
      console.log('[DISCOVERY] New peer discovered:', peer);
      this.peers.set(peer.deviceId, peer);
      
      if (this.onPeerDiscovered) {
        this.onPeerDiscovered(peer);
      }
    }
  }

  getPeers(): DiscoveredPeer[] {
    return Array.from(this.peers.values());
  }

  async findLocalPeers(): Promise<DiscoveredPeer[]> {
    if (!this.mdnsSupported) return [];
    
    return this.getPeers().filter(peer => peer.networkType === 'local');
  }

  async findInternetPeers(): Promise<DiscoveredPeer[]> {
    return this.getPeers().filter(peer => peer.networkType === 'internet');
  }

  stopDiscovery(): void {
    // Cleanup discovery resources
    this.peers.clear();
    console.log('[DISCOVERY] Peer discovery stopped');
  }
}
