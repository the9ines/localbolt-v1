
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
  private mdnsResponder: any | null = null;
  private localPeers: Set<string> = new Set();
  private isLocalDiscoverySupported: boolean = false;
  private isOnline: boolean = navigator.onLine;
  private supabaseChannel: any = null;
  private broadcastInterval: number | null = null;

  constructor(
    private localPeerId: string,
    private onSignal: SignalHandler
  ) {
    this.setupNetworkListeners();
    this.initializeLocalDiscovery();
    
    // Only setup Supabase channel if online
    if (this.isOnline) {
      this.setupChannel();
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[SIGNALING] Network connection restored');
      this.isOnline = true;
      this.setupChannel();
    });

    window.addEventListener('offline', () => {
      console.log('[SIGNALING] Network connection lost, switching to local only');
      this.isOnline = false;
      this.disconnectChannel();
    });
  }

  private async setupChannel() {
    if (!this.isOnline) {
      console.log('[SIGNALING] Skipping remote channel setup - offline mode');
      return;
    }

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

  private async initializeLocalDiscovery() {
    try {
      if ('mDNS' in window || 'RTCPeerConnection' in window) {
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
    } catch (error) {
      console.warn('[DISCOVERY] Local discovery not available:', error);
    }
  }

  private startLocalBroadcast() {
    // Broadcast presence every 5 seconds
    this.broadcastInterval = window.setInterval(() => {
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
    }, 5000);
  }

  private handleLocalPeerDiscovered(peer: PeerInfo) {
    console.log('[DISCOVERY] Found local peer:', peer.id);
    this.localPeers.add(peer.id);
    
    // Notify about discovered peer
    const event = new CustomEvent('localbolt-peer-discovered', {
      detail: peer,
      bubbles: true
    });
    window.dispatchEvent(event);
  }

  async sendSignal(type: SignalData['type'], data: any, remotePeerId: string) {
    console.log('[SIGNALING] Sending signal:', type, 'to:', remotePeerId);
    
    // Always try local delivery first
    if (this.isLocalDiscoverySupported) {
      try {
        await this.sendLocalSignal(type, data, remotePeerId);
        if (this.localPeers.has(remotePeerId)) {
          return; // If it's a known local peer, don't try remote signaling
        }
      } catch (error) {
        console.log('[DISCOVERY] Local signal failed:', error);
      }
    }

    // Only attempt remote signaling if online
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
    } else if (!this.isLocalDiscoverySupported) {
      throw new SignalingError('No available signaling methods');
    }
  }

  private async sendLocalSignal(type: SignalData['type'], data: any, remotePeerId: string) {
    const signal: SignalData = {
      type,
      data,
      from: this.localPeerId,
      to: remotePeerId
    };

    const event = new CustomEvent('localbolt-signal', { 
      detail: signal,
      bubbles: true 
    });
    window.dispatchEvent(event);
  }

  isLocalPeer(peerId: string): boolean {
    return this.localPeers.has(peerId);
  }

  getDiscoveryStatus() {
    return {
      isOnline: this.isOnline,
      localDiscoverySupported: this.isLocalDiscoverySupported,
      localPeersCount: this.localPeers.size,
      localPeers: Array.from(this.localPeers),
      remoteSignalingAvailable: Boolean(this.supabaseChannel)
    };
  }

  cleanup() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    this.disconnectChannel();
    this.localPeers.clear();
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
