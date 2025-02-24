
import { supabase } from "@/integrations/supabase/client";
import { SignalingError } from "@/types/webrtc-errors";
import { TransportMode, type PeerInfo } from './protocol/ConnectionNegotiator';

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  from: string;
  to: string;
}

export type SignalHandler = (signal: SignalData) => void;

export class SignalingService {
  private localPeers: Map<string, PeerInfo> = new Map();
  private isOnline: boolean = navigator.onLine;
  private supabaseChannel: any = null;
  private broadcastInterval: number | null = null;
  private isLocalDiscoverySupported: boolean = false;

  constructor(
    private localPeerId: string,
    private onSignal: SignalHandler
  ) {
    this.setupNetworkListeners();
    this.initializeLocalDiscovery();
    
    if (this.isOnline) {
      this.setupChannel();
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[SIGNALING] Network connection restored');
      this.isOnline = true;
      this.setupChannel();
      this.broadcastPresence();
    });

    window.addEventListener('offline', () => {
      console.log('[SIGNALING] Network connection lost, switching to local only');
      this.isOnline = false;
      this.disconnectChannel();
    });
  }

  private async initializeLocalDiscovery() {
    if ('RTCPeerConnection' in window) {
      this.isLocalDiscoverySupported = true;
      console.log('[DISCOVERY] Local discovery supported');
      
      // Start broadcasting presence
      this.startLocalBroadcast();
      
      // Listen for other peers
      window.addEventListener('localbolt-peer-announce', ((event: CustomEvent<PeerInfo>) => {
        if (event.detail.id !== this.localPeerId) {
          this.handleLocalPeerDiscovered(event.detail);
        }
      }) as EventListener);
    }
  }

  private startLocalBroadcast() {
    this.broadcastPresence();
    this.broadcastInterval = window.setInterval(() => this.broadcastPresence(), 5000);
  }

  private broadcastPresence() {
    const peerInfo: PeerInfo = {
      id: this.localPeerId,
      capabilities: {
        mdns: this.isLocalDiscoverySupported,
        webrtc: true,
        encryption: ['tweetnacl']
      },
      networkType: this.isOnline ? TransportMode.INTERNET : TransportMode.LOCAL,
      timestamp: Date.now()
    };

    const event = new CustomEvent('localbolt-peer-announce', {
      detail: peerInfo,
      bubbles: true
    });
    window.dispatchEvent(event);
  }

  private handleLocalPeerDiscovered(peer: PeerInfo) {
    console.log('[DISCOVERY] Found local peer:', peer.id);
    this.localPeers.set(peer.id, peer);
    
    const event = new CustomEvent('localbolt-peer-discovered', {
      detail: peer,
      bubbles: true
    });
    window.dispatchEvent(event);
  }

  private async setupChannel() {
    if (!this.isOnline) return;

    console.log('[SIGNALING] Setting up remote signaling channel');
    try {
      this.supabaseChannel = supabase.channel('signals')
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          console.log('[SIGNALING] Received remote signal:', payload.type);
          this.onSignal(payload as SignalData);
        })
        .subscribe();
    } catch (error) {
      console.warn('[SIGNALING] Failed to setup remote channel:', error);
    }
  }

  async sendSignal(type: SignalData['type'], data: any, remotePeerId: string) {
    console.log('[SIGNALING] Sending signal:', type, 'to:', remotePeerId);
    
    if (this.localPeers.has(remotePeerId)) {
      const signal: SignalData = {
        type,
        data,
        from: this.localPeerId,
        to: remotePeerId
      };
      window.dispatchEvent(new CustomEvent('localbolt-signal', { detail: signal }));
      return;
    }
    
    if (this.isOnline && this.supabaseChannel) {
      try {
        await this.supabaseChannel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type,
            data,
            from: this.localPeerId,
            to: remotePeerId,
          },
        });
      } catch (error) {
        throw new SignalingError(`Failed to send ${type} signal`, error);
      }
    } else {
      throw new SignalingError('No available signaling methods');
    }
  }

  getDiscoveryStatus() {
    // Clean up old peers
    const now = Date.now();
    for (const [id, peer] of this.localPeers.entries()) {
      if (now - peer.timestamp > 30000) {
        this.localPeers.delete(id);
      }
    }

    return {
      isOnline: this.isOnline,
      remoteSignalingAvailable: Boolean(this.supabaseChannel),
      localDiscoverySupported: this.isLocalDiscoverySupported,
      localPeersCount: this.localPeers.size,
      localPeers: Array.from(this.localPeers.values()).map(p => p.id)
    };
  }

  cleanup() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    this.disconnectChannel();
    window.removeEventListener('online', () => this.setupChannel());
    window.removeEventListener('offline', () => this.disconnectChannel());
  }

  private disconnectChannel() {
    if (this.supabaseChannel) {
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }
  }
}
