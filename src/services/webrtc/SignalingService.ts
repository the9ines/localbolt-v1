
import { supabase } from "@/integrations/supabase/client";
import { SignalingError } from "@/types/webrtc-errors";

export interface SignalData {
  readonly type: 'offer' | 'answer' | 'ice-candidate';
  readonly data: {
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    publicKey?: string;
    peerCode?: string;
  } | RTCIceCandidateInit;
  readonly from: string;
  readonly to: string;
}

export type SignalHandler = (signal: SignalData) => void;

export class SignalingService {
  private channelSubscription: ReturnType<typeof supabase.channel> | null = null;
  private isInitialized = false;

  constructor(
    private readonly localPeerId: string,
    private readonly onSignal: SignalHandler
  ) {}

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.setupChannel();
      this.isInitialized = true;
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

      this.channelSubscription = supabase.channel('signals')
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          if (!this.validateSignalPayload(payload)) {
            console.error('[SIGNALING] Received invalid signal payload');
            return;
          }
          console.log('[SIGNALING] Received signal:', payload.type);
          this.onSignal(payload as SignalData);
        })
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') {
            console.error('[SIGNALING] Channel subscription failed:', status);
            throw new SignalingError(`Channel subscription failed: ${status}`);
          }
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

  async sendSignal(type: SignalData['type'], data: SignalData['data'], remotePeerId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new SignalingError('SignalingService not initialized');
    }

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
        this.channelSubscription = null;
      }
      this.isInitialized = false;
    } catch (error) {
      console.error('[SIGNALING] Cleanup error:', error);
    }
  }
}
