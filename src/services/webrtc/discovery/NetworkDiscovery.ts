
import { SignalingService } from '../SignalingService';
import type { DiscoveredPeer, NetworkType, PeerInfo } from '../types/discovery-types';
import { WebRTCError } from '@/types/webrtc-errors';

export class NetworkDiscovery {
  private peers: Map<string, DiscoveredPeer> = new Map();
  private mdnsSupported: boolean = false;
  private mDNSService: RTCPeerConnection | null = null;

  readonly modes = {
    LOCAL: 'mdns' as const,
    INTERNET: 'signaling' as const
  };

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

  async discoverPeers(): Promise<DiscoveredPeer[]> {
    // Try local discovery first
    const localPeers = await this.findLocalPeers();
    if (localPeers.length > 0) {
      console.log('[DISCOVERY] Found local peers:', localPeers);
      return localPeers;
    }

    // Fallback to signaling
    console.log('[DISCOVERY] No local peers found, using signaling');
    return this.findInternetPeers();
  }

  private async startLocalDiscovery(): Promise<void> {
    if (!this.mdnsSupported) {
      console.log('[DISCOVERY] mDNS not supported, skipping local discovery');
      return;
    }

    try {
      this.mDNSService = new RTCPeerConnection({
        iceServers: [], // Local only
        iceTransportPolicy: 'all'
      });

      // Setup local discovery channel
      const discoveryChannel = this.mDNSService.createDataChannel('discovery', {
        ordered: true,
        negotiated: true,
        id: 0
      });

      discoveryChannel.onmessage = (event) => {
        try {
          const peer = JSON.parse(event.data) as DiscoveredPeer;
          this.handleDiscoveredPeer(peer);
        } catch (error) {
          console.error('[DISCOVERY] Failed to parse peer data:', error);
        }
      };

      // Broadcast local peer info
      discoveryChannel.onopen = () => {
        if (discoveryChannel.readyState === 'open') {
          const localPeer: DiscoveredPeer = {
            ...this.localPeerInfo,
            timestamp: Date.now()
          };
          discoveryChannel.send(JSON.stringify(localPeer));
        }
      };

    } catch (error) {
      console.error('[DISCOVERY] Local discovery error:', error);
      throw new WebRTCError('Local discovery failed', error);
    }
  }

  private async handleDiscoveredPeer(peer: DiscoveredPeer): Promise<void> {
    if (!this.peers.has(peer.deviceId)) {
      console.log('[DISCOVERY] New peer discovered:', peer);
      this.peers.set(peer.deviceId, peer);
      
      if (this.onPeerDiscovered) {
        this.onPeerDiscovered(peer);
      }
    }
  }

  async findLocalPeers(): Promise<DiscoveredPeer[]> {
    if (!this.mdnsSupported) return [];
    
    await this.startLocalDiscovery();
    return Array.from(this.peers.values())
      .filter(peer => peer.networkType === 'local');
  }

  async findInternetPeers(): Promise<DiscoveredPeer[]> {
    return Array.from(this.peers.values())
      .filter(peer => peer.networkType === 'internet');
  }

  stopDiscovery(): void {
    if (this.mDNSService) {
      this.mDNSService.close();
      this.mDNSService = null;
    }
    this.peers.clear();
    console.log('[DISCOVERY] Discovery stopped');
  }
}
