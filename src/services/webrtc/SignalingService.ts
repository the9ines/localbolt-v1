
import { supabase } from "@/integrations/supabase/client";
import { SignalingError } from "@/types/webrtc-errors";

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  from: string;
  to: string;
}

type SignalHandler = (signal: SignalData) => void;
type EventHandler = (...args: any[]) => void;

export class SignalingService {
  private handlers: { [key: string]: EventHandler[] } = {};
  private channel: ReturnType<typeof supabase.channel> | null = null;

  constructor(
    private localPeerId: string,
    private onSignal: SignalHandler
  ) {
    this.setupChannel();
  }

  private async setupChannel() {
    console.log('[SIGNALING] Setting up signaling channel');
    try {
      this.channel = supabase.channel('signals')
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          console.log('[SIGNALING] Received signal:', payload.type);
          this.onSignal(payload as SignalData);
        })
        .subscribe();
    } catch (error) {
      throw new SignalingError("Failed to setup signaling channel", error);
    }
  }

  async sendSignal(type: SignalData['type'], data: any, remotePeerId: string) {
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

  // Add required signaling methods
  async sendOffer(offer: RTCSessionDescriptionInit, remotePeerId: string) {
    await this.sendSignal('offer', { offer }, remotePeerId);
  }

  async sendAnswer(answer: RTCSessionDescriptionInit, remotePeerId: string) {
    await this.sendSignal('answer', { answer }, remotePeerId);
  }

  async sendICECandidate(candidate: RTCIceCandidate, remotePeerId: string) {
    await this.sendSignal('ice-candidate', candidate, remotePeerId);
  }

  // Event handling methods
  on(event: string, handler: EventHandler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }

  off(event: string, handler: EventHandler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  emit(event: string, ...args: any[]) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => handler(...args));
    }
  }
}
