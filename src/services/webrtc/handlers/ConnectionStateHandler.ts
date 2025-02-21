
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';

export class ConnectionStateHandler {
  private connectionAttempts: number = 0;
  private readonly maxConnectionAttempts: number = 3;
  private connectionStateListener?: (state: RTCPeerConnectionState) => void;
  private onRemotePeerCodeUpdate?: (code: string) => void;

  constructor(
    onRemotePeerCodeUpdate?: (code: string) => void,
    connectionStateListener?: (state: RTCPeerConnectionState) => void
  ) {
    this.onRemotePeerCodeUpdate = onRemotePeerCodeUpdate;
    this.connectionStateListener = connectionStateListener;
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    console.log('[WEBRTC] Setting connection state handler');
    this.connectionStateListener = handler;
  }

  handleConnectionStateChange(state: RTCPeerConnectionState, remotePeerCode: string) {
    console.log('[CONNECTION] State changed:', state);
    if (state === 'connected') {
      console.log('[CONNECTION] Connected, updating remote peer code:', remotePeerCode);
      this.connectionAttempts = 0;
      if (this.onRemotePeerCodeUpdate) {
        this.onRemotePeerCodeUpdate(remotePeerCode);
      }
    }
    if (this.connectionStateListener) {
      this.connectionStateListener(state);
    }
  }

  handleDisconnection() {
    console.log('[CONNECTION] Handling disconnection');
    if (this.onRemotePeerCodeUpdate) {
      this.onRemotePeerCodeUpdate('');
    }
    this.connectionAttempts = 0;
    if (this.connectionStateListener) {
      this.connectionStateListener('disconnected');
    }
  }

  shouldRetryConnection(): boolean {
    return this.connectionAttempts < this.maxConnectionAttempts;
  }

  incrementConnectionAttempts() {
    this.connectionAttempts++;
  }
}
