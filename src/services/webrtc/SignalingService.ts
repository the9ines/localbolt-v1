
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
  private isConnected: boolean = false;
  private pendingMessages: SignalData[] = [];
  private connectionAttempts: number = 0;
  private readonly MAX_RETRIES = 3;

  constructor(
    private localPeerId: string,
    private onSignal: SignalHandler
  ) {
    console.log('[SIGNALING] Initializing with peer ID:', localPeerId);
    this.setupChannel();
  }

  private async setupChannel() {
    console.log('[SIGNALING] Setting up signaling channel');
    
    try {
      // Clean up any existing subscription
      if (this.channel) {
        await this.channel.unsubscribe();
      }

      this.channel = supabase.channel('signals', {
        config: {
          broadcast: { ack: true }
        }
      });

      this.channel
        .on('presence', { event: 'sync' }, () => {
          console.log('[SIGNALING] Channel presence synced');
        })
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          console.log('[SIGNALING] Received signal:', payload.type, 'from:', payload.from, 'to:', payload.to);
          
          if (payload.to === this.localPeerId) {
            this.onSignal(payload as SignalData);
          }
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          console.log('[SIGNALING] Peer joined:', key);
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log('[SIGNALING] Peer left:', key);
        });

      const status = await this.channel.subscribe(async (status: string) => {
        console.log('[SIGNALING] Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          this.connectionAttempts = 0;
          
          // Send any pending messages
          while (this.pendingMessages.length > 0) {
            const msg = this.pendingMessages.shift();
            if (msg) {
              await this.sendSignal(msg.type, msg.data, msg.to);
            }
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isConnected = false;
          await this.handleDisconnect();
        }
      });

      if (status === 'SUBSCRIBED') {
        this.isConnected = true;
        console.log('[SIGNALING] Channel successfully subscribed');
      }

    } catch (error) {
      console.error('[SIGNALING] Setup error:', error);
      await this.handleDisconnect();
      throw new SignalingError("Failed to setup signaling channel", error);
    }
  }

  private async handleDisconnect() {
    console.log('[SIGNALING] Handling disconnect, attempt:', this.connectionAttempts);
    
    if (this.connectionAttempts < this.MAX_RETRIES) {
      this.connectionAttempts++;
      console.log('[SIGNALING] Attempting reconnection...');
      
      try {
        await this.setupChannel();
      } catch (error) {
        console.error('[SIGNALING] Reconnection failed:', error);
        throw new SignalingError("Failed to reconnect to signaling channel", error);
      }
    } else {
      console.error('[SIGNALING] Max reconnection attempts reached');
      throw new SignalingError("Maximum reconnection attempts reached");
    }
  }

  async sendSignal(type: SignalData['type'], data: any, remotePeerId: string) {
    console.log('[SIGNALING] Sending signal:', type, 'to:', remotePeerId);
    
    const signal: SignalData = {
      type,
      data,
      from: this.localPeerId,
      to: remotePeerId,
    };

    if (!this.isConnected) {
      console.log('[SIGNALING] Channel not ready, queuing message');
      this.pendingMessages.push(signal);
      return;
    }

    try {
      const result = await this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: signal,
      });

      if (!result.error) {
        console.log('[SIGNALING] Signal sent successfully');
      } else {
        console.error('[SIGNALING] Error sending signal:', result.error);
        throw new SignalingError(`Failed to send ${type} signal`, result.error);
      }
    } catch (error) {
      console.error('[SIGNALING] Send error:', error);
      throw new SignalingError(`Failed to send ${type} signal`, error);
    }
  }

  async cleanup() {
    console.log('[SIGNALING] Cleaning up...');
    if (this.channel) {
      try {
        await this.channel.unsubscribe();
        this.isConnected = false;
        this.pendingMessages = [];
      } catch (error) {
        console.error('[SIGNALING] Cleanup error:', error);
      }
    }
  }
}
