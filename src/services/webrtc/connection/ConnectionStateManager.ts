
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';

export class ConnectionStateManager {
  private autoReconnectEnabled: boolean = true; // Changed to true by default
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5; // Increased from 3 to 5
  private reconnectTimeout?: NodeJS.Timeout;
  private isReconnecting: boolean = false;

  constructor(
    private onError: (error: WebRTCError) => void,
    private connect: (remotePeerCode: string) => Promise<void>
  ) {}

  async handleReconnect(remotePeerCode: string) {
    if (this.isReconnecting || !remotePeerCode || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WEBRTC] Not attempting reconnection:', {
        isReconnecting: this.isReconnecting,
        remotePeerCode,
        attempts: this.reconnectAttempts
      });
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    console.log(`[WEBRTC] Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    try {
      await this.connect(remotePeerCode);
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
    } catch (error) {
      console.error('[WEBRTC] Reconnection attempt failed:', error);
      const backoffTime = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000); // Reduced max backoff
      this.reconnectTimeout = setTimeout(() => {
        this.isReconnecting = false;
        this.handleReconnect(remotePeerCode);
      }, backoffTime);
    }
  }

  handleConnectionStateChange(state: RTCPeerConnectionState, remotePeerCode: string) {
    console.log('[WEBRTC] Connection state changed to:', state, 'for peer:', remotePeerCode);
    
    if (state === 'disconnected' || state === 'failed') {
      console.log('[WEBRTC] Connection lost, initiating recovery...');
      this.handleReconnect(remotePeerCode);
    } else if (state === 'connected') {
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = undefined;
      }
    }
  }

  cleanup() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
  }

  reset() {
    this.cleanup();
    this.autoReconnectEnabled = true; // Reset to enabled state
  }
}
