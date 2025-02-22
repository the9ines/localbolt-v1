
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
  private channel: any;
  private isChannelReady: boolean = false;
  private messageQueue: { type: SignalData['type'], data: any, remotePeerId: string }[] = [];

  constructor(
    private localPeerId: string,
    private onSignal: SignalHandler
  ) {
    this.setupChannel();
  }

  private async setupChannel() {
    console.log('[SIGNALING] Setting up signaling channel');
    try {
      // Create a new channel subscription
      this.channel = supabase.channel('signals', {
        config: {
          broadcast: { self: true }, // Enable receiving our own messages for debugging
          presence: { key: this.localPeerId }, // Enable presence to track peers
        }
      });

      // Handle signal messages
      this.channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
        console.log('[SIGNALING] Received signal:', payload.type, 'from:', payload.from, 'to:', payload.to);
        
        // Only process messages intended for us
        if (payload.to === this.localPeerId) {
          this.onSignal(payload as SignalData);
        }
      });

      // Handle channel status
      this.channel.subscribe(async (status: string) => {
        console.log('[SIGNALING] Channel status:', status);
        
        if (status === 'SUBSCRIBED') {
          this.isChannelReady = true;
          console.log('[SIGNALING] Channel ready, processing queued messages');
          
          // Process any queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg) {
              await this.sendSignal(msg.type, msg.data, msg.remotePeerId);
            }
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isChannelReady = false;
          console.error('[SIGNALING] Channel error or closed, reconnecting...');
          setTimeout(() => this.setupChannel(), 1000); // Retry after 1 second
        }
      });

    } catch (error) {
      console.error('[SIGNALING] Setup error:', error);
      throw new SignalingError("Failed to setup signaling channel", error);
    }
  }

  async sendSignal(type: SignalData['type'], data: any, remotePeerId: string) {
    const message = {
      type,
      data,
      from: this.localPeerId,
      to: remotePeerId,
    };

    console.log('[SIGNALING] Sending signal:', type, 'to:', remotePeerId);

    try {
      if (!this.isChannelReady) {
        console.log('[SIGNALING] Channel not ready, queuing message');
        this.messageQueue.push({ type, data, remotePeerId });
        return;
      }

      await this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: message,
      });

      console.log('[SIGNALING] Signal sent successfully');
    } catch (error) {
      console.error('[SIGNALING] Failed to send signal:', error);
      throw new SignalingError(`Failed to send ${type} signal`, error);
    }
  }
}
