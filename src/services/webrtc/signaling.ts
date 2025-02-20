
import { supabase } from "@/integrations/supabase/client";
import { SignalData } from "./types";

export class SignalingService {
  constructor(
    private localPeerCode: string,
    private onSignal: (signal: SignalData) => void,
    private onError?: (error: any) => void
  ) {
    this.setupSignalingListener();
  }

  private async setupSignalingListener() {
    console.log('[SIGNALING] Setting up signal listener');
    try {
      const channel = supabase.channel('signals')
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          console.log('[SIGNALING] Received signal:', payload.type);
          if (payload.to === this.localPeerCode) {
            this.onSignal(payload as SignalData);
          }
        })
        .subscribe();
    } catch (error) {
      console.error('[SIGNALING] Setup error:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  async sendSignal(type: SignalData['type'], data: any, remotePeerCode: string) {
    console.log(`[SIGNALING] Sending ${type} to peer ${remotePeerCode}`);
    try {
      await supabase.channel('signals').send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          type,
          data,
          from: this.localPeerCode,
          to: remotePeerCode,
        },
      });
    } catch (error) {
      console.error('[SIGNALING] Send error:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }
}
