
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
  private initialized: boolean = false;
  private channel: any = null;
  
  constructor(
    private localPeerId: string,
    private onSignal: SignalHandler
  ) {
    console.log('[SIGNALING] Creating signaling service for peer:', localPeerId);
  }

  /**
   * Initializes the signaling service and sets up the channel
   * This must be called before sending any signals
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[SIGNALING] Signaling service already initialized');
      return;
    }
    
    try {
      await this.setupChannel();
      this.initialized = true;
    } catch (error) {
      console.error('[SIGNALING] Failed to initialize:', error);
      throw new SignalingError("Failed to initialize signaling service", error);
    }
  }

  private async setupChannel() {
    console.log('[SIGNALING] Setting up signaling channel');
    try {
      this.channel = supabase.channel('signals')
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          if (payload?.to === this.localPeerId) {
            console.log('[SIGNALING] Received signal:', payload.type, 'from:', payload.from);
            this.onSignal(payload as SignalData);
          }
        })
        .subscribe();
    } catch (error) {
      throw new SignalingError("Failed to setup signaling channel", error);
    }
  }

  async sendSignal(type: SignalData['type'], data: any, remotePeerId: string) {
    // Ensure initialization before sending signals
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!remotePeerId) {
      throw new SignalingError("Cannot send signal: No remote peer ID specified");
    }
    
    console.log('[SIGNALING] Sending signal:', type, 'to:', remotePeerId);
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
}
