
import { supabase } from "@/integrations/supabase/client";
import { SignalingError } from "@/types/webrtc-errors";

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
      // Don't throw - we can still work with local discovery
    }
  }

  private disconnectChannel() {
    if (this.supabaseChannel) {
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }
  }

  private async initializeLocalDiscovery() {
    if ('mDNS' in window) {
      try {
        // Check if we're in a secure context (HTTPS or localhost)
        if (window.isSecureContext) {
          this.isLocalDiscoverySupported = true;
          console.log('[MDNS] Local discovery supported');
          await this.startLocalDiscovery();
        } else {
          console.log('[MDNS] Secure context required for mDNS');
        }
      } catch (error) {
        console.warn('[MDNS] Local discovery not available:', error);
      }
    } else {
      console.log('[MDNS] mDNS not supported in this environment');
    }
  }

  private async startLocalDiscovery() {
    if (!this.isLocalDiscoverySupported) return;

    try {
      // Publish our service
      const serviceName = `_localbolt._tcp.local`;
      const instanceName = `${this.localPeerId}._localbolt._tcp.local`;
      
      console.log('[MDNS] Starting local discovery service');
      
      // Listen for local peer announcements
      window.addEventListener('mdns-service-found', (event: any) => {
        if (event.service.type === '_localbolt._tcp.local') {
          const peerId = event.service.name.split('.')[0];
          if (peerId !== this.localPeerId) {
            this.localPeers.add(peerId);
            console.log('[MDNS] Found local peer:', peerId);
          }
        }
      });

      // Periodically announce our presence on the local network
      setInterval(() => {
        if (this.isLocalDiscoverySupported) {
          const announceEvent = new CustomEvent('localbolt-announce', {
            detail: { peerId: this.localPeerId },
            bubbles: true
          });
          window.dispatchEvent(announceEvent);
        }
      }, 10000); // Announce every 10 seconds

    } catch (error) {
      console.warn('[MDNS] Failed to start local discovery:', error);
    }
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
        console.log('[MDNS] Local signal failed:', error);
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
    if (!this.isLocalDiscoverySupported) {
      throw new Error('Local discovery not supported');
    }

    const signal: SignalData = {
      type,
      data,
      from: this.localPeerId,
      to: remotePeerId
    };

    try {
      const instanceName = `${remotePeerId}._localbolt._tcp.local`;
      console.log('[MDNS] Attempting local signal to:', instanceName);
      
      const event = new CustomEvent('localbolt-signal', { 
        detail: signal,
        bubbles: true 
      });
      window.dispatchEvent(event);
      
    } catch (error) {
      throw new SignalingError('Failed to send local signal', error);
    }
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
    this.disconnectChannel();
    this.localPeers.clear();
    window.removeEventListener('online', this.setupChannel);
    window.removeEventListener('offline', this.disconnectChannel);
  }
}
