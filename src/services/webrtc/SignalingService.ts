
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
  private isInitialized: boolean = false;

  constructor(
    private localPeerId: string,
    private onSignal: SignalHandler
  ) {}

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[SIGNALING] Setting up signaling channel');
    try {
      const channel = supabase.channel('signals')
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          console.log('[SIGNALING] Received signal:', payload.type);
          this.onSignal(payload as SignalData);
        })
        .subscribe();
      
      this.isInitialized = true;
    } catch (error) {
      throw new SignalingError("Failed to setup signaling channel", error);
    }
  }

  async sendSignal(type: SignalData['type'], data: any, remotePeerId: string) {
    if (!this.isInitialized) {
      await this.initialize();
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
