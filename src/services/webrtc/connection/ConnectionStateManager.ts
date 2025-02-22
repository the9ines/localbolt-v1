
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';

export class ConnectionStateManager {
  private autoReconnectEnabled: boolean = true;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 3;
  private reconnectTimeout?: NodeJS.Timeout;

  constructor(
    private onError: (error: WebRTCError) => void,
    private connect: (remotePeerCode: string) => Promise<void>
  ) {}

  async handleReconnect(remotePeerCode: string) {
    if (!this.autoReconnectEnabled || !remotePeerCode || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WEBRTC] Not attempting reconnection:', {
        autoReconnectEnabled: this.autoReconnectEnabled,
        remotePeerCode,
        attempts: this.reconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    console.log(`[WEBRTC] Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    try {
      await this.connect(remotePeerCode);
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('[WEBRTC] Reconnection attempt failed:', error);
      const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      this.reconnectTimeout = setTimeout(() => this.handleReconnect(remotePeerCode), backoffTime);
    }
  }

  handleConnectionStateChange(state: RTCPeerConnectionState, remotePeerCode: string) {
    if (state === 'disconnected' || state === 'failed') {
      console.log('[WEBRTC] Connection lost, initiating recovery...');
      this.handleReconnect(remotePeerCode);
    }
  }

  cleanup() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    this.autoReconnectEnabled = false;
    this.reconnectAttempts = 0;
  }

  reset() {
    this.reconnectAttempts = 0;
  }
}
