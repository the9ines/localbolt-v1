
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

  constructor(
    private localPeerId: string,
    private onSignal: SignalHandler
  ) {
    this.setupChannel();
    this.initializeLocalDiscovery();
  }

  private async setupChannel() {
    console.log('[SIGNALING] Setting up signaling channel');
    try {
      const channel = supabase.channel('signals')
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          console.log('[SIGNALING] Received remote signal:', payload.type);
          this.onSignal(payload as SignalData);
        })
        .subscribe();
    } catch (error) {
      throw new SignalingError("Failed to setup signaling channel", error);
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
      
      // Attempt to start mDNS discovery
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

    } catch (error) {
      console.warn('[MDNS] Failed to start local discovery:', error);
    }
  }

  async sendSignal(type: SignalData['type'], data: any, remotePeerId: string) {
    console.log('[SIGNALING] Sending signal:', type, 'to:', remotePeerId);
    
    // Try local delivery first if peer is on local network
    if (this.localPeers.has(remotePeerId)) {
      try {
        await this.sendLocalSignal(type, data, remotePeerId);
        return;
      } catch (error) {
        console.log('[MDNS] Local signal failed, falling back to remote:', error);
      }
    }

    // Fallback to remote signaling
    try {
      await supabase.channel('signals').send({
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

    // Use mDNS for local signaling
    try {
      const instanceName = `${remotePeerId}._localbolt._tcp.local`;
      console.log('[MDNS] Attempting local signal to:', instanceName);
      
      // In a real implementation, this would use actual mDNS communication
      // For now, we'll emit a custom event that will be caught by the local peer
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
      localDiscoverySupported: this.isLocalDiscoverySupported,
      localPeersCount: this.localPeers.size,
      localPeers: Array.from(this.localPeers)
    };
  }
}
