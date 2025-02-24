
import type { NetworkType, PeerInfo, TransportMode } from '../types/discovery';
import { WebRTCError } from '@/types/webrtc-errors';

export class ConnectionNegotiator {
  constructor(private localPeerInfo: PeerInfo) {}

  async selectBestTransport(peer: PeerInfo): Promise<TransportMode> {
    try {
      if (await this.isLocalNetworkAvailable(peer)) {
        console.log('[NEGOTIATOR] Local network available, using mDNS');
        return 'mdns';
      }
      
      console.log('[NEGOTIATOR] Using signaling fallback');
      return 'signaling';
    } catch (error) {
      console.error('[NEGOTIATOR] Transport selection failed:', error);
      throw new WebRTCError('Transport selection failed', error);
    }
  }

  private async isLocalNetworkAvailable(peer: PeerInfo): Promise<boolean> {
    // Check if both peers support local discovery
    if (!this.localPeerInfo.capabilities.mdns || !peer.capabilities.mdns) {
      return false;
    }

    try {
      // Check if peers are on the same network
      // This is a basic check that will be enhanced later
      return peer.networkType === 'local';
    } catch (error) {
      console.warn('[NEGOTIATOR] Local network check failed:', error);
      return false;
    }
  }

  async negotiateConnection(peer: PeerInfo): Promise<RTCSessionDescription | null> {
    const transportMode = await this.selectBestTransport(peer);
    
    try {
      if (transportMode === 'mdns') {
        return await this.negotiateLocalConnection(peer);
      } else {
        return await this.negotiateSignalingConnection(peer);
      }
    } catch (error) {
      console.error('[NEGOTIATOR] Connection negotiation failed:', error);
      throw new WebRTCError('Connection negotiation failed', error);
    }
  }

  private async negotiateLocalConnection(peer: PeerInfo): Promise<RTCSessionDescription | null> {
    // Local connection negotiation using mDNS
    // This will be implemented as browser support improves
    console.log('[NEGOTIATOR] Local connection negotiation not yet implemented');
    return null;
  }

  private async negotiateSignalingConnection(peer: PeerInfo): Promise<RTCSessionDescription | null> {
    // Use existing signaling connection logic
    // This is already implemented in SignalingService
    console.log('[NEGOTIATOR] Using signaling connection');
    return null;
  }
}
