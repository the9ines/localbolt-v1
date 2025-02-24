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
  private localPeers: Set<string> = new Set();
  private isOnline: boolean = navigator.onLine;
  private supabaseChannel: any = null;

  constructor(
    private localPeerId: string,
    private onSignal: SignalHandler
  ) {
    this.setupNetworkListeners();
    
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

  async sendSignal(type: SignalData['type'], data: any, remotePeerId: string) {
    console.log('[SIGNALING] Sending signal:', type, 'to:', remotePeerId);
    
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
    return {
      isOnline: this.isOnline,
      remoteSignalingAvailable: Boolean(this.supabaseChannel)
    };
  }

  cleanup() {
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
