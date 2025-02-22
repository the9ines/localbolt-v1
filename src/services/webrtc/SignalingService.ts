
import { supabase } from "@/integrations/supabase/client";
import { SignalingError } from "@/types/webrtc-errors";

export interface SignalData {
  readonly type: 'offer' | 'answer' | 'ice-candidate';
  readonly data: unknown;
  readonly from: string;
  readonly to: string;
}

export type SignalHandler = (signal: SignalData) => void;

export class SignalingService {
  private readonly channelSubscription: ReturnType<typeof supabase.channel> | null;
  private readonly localPeerId: string;
  private readonly onSignal: SignalHandler;

  constructor(localPeerId: string, onSignal: SignalHandler) {
    this.localPeerId = localPeerId;
    this.onSignal = onSignal;
    this.channelSubscription = null;
    
    // Initialize channel after construction
    this.initializeChannel();
  }

  private async initializeChannel(): Promise<void> {
    try {
      await this.setupChannel();
    } catch (error) {
      console.error('[SIGNALING] Failed to setup channel:', error);
      throw new SignalingError('Failed to initialize signaling service', error);
    }
  }

  private async setupChannel(): Promise<void> {
    console.log('[SIGNALING] Setting up signaling channel');
    try {
      if (this.channelSubscription) {
        await this.channelSubscription.unsubscribe();
      }

      const channel = supabase.channel('signals')
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          if (this.validateSignalPayload(payload)) {
            console.log('[SIGNALING] Received signal:', payload.type);
            this.onSignal(payload);
          } else {
            console.error('[SIGNALING] Received invalid signal payload');
          }
        });

      const subscription = await channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.error('[SIGNALING] Channel subscription failed:', status);
          throw new SignalingError(`Channel subscription failed: ${status}`);
        }
      });

      Object.defineProperty(this, 'channelSubscription', {
        value: subscription,
        writable: false
      });
    } catch (error) {
      throw new SignalingError("Failed to setup signaling channel", error);
    }
  }

  private validateSignalPayload(payload: unknown): payload is SignalData {
    if (!payload || typeof payload !== 'object') return false;
    
    const signal = payload as Partial<SignalData>;
    return (
      typeof signal.type === 'string' &&
      ['offer', 'answer', 'ice-candidate'].includes(signal.type) &&
      typeof signal.from === 'string' &&
      typeof signal.to === 'string' &&
      signal.data !== undefined
    );
  }

  async sendSignal(type: SignalData['type'], data: unknown, remotePeerId: string): Promise<void> {
    if (!this.channelSubscription) {
      throw new SignalingError('No active channel subscription');
    }

    console.log('[SIGNALING] Sending signal:', type, 'to:', remotePeerId);
    
    try {
      const signal: SignalData = {
        type,
        data,
        from: this.localPeerId,
        to: remotePeerId,
      };

      await this.channelSubscription.send({
        type: 'broadcast',
        event: 'signal',
        payload: signal,
      });
    } catch (error) {
      const errorMessage = `Failed to send ${type} signal`;
      console.error('[SIGNALING]', errorMessage, error);
      throw new SignalingError(errorMessage, error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.channelSubscription) {
        await this.channelSubscription.unsubscribe();
        Object.defineProperty(this, 'channelSubscription', {
          value: null,
          writable: false
        });
      }
    } catch (error) {
      console.error('[SIGNALING] Cleanup error:', error);
    }
  }
}
