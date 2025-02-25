
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './types/transfer';
import { ConnectionManager } from './ConnectionManager';
import { DataChannelManager } from './DataChannelManager';

export class WebRTCEventManager {
  private connectionStateListener?: (state: RTCPeerConnectionState) => void;
  private isDisconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;

  constructor(
    private connectionManager: ConnectionManager,
    private dataChannelManager: DataChannelManager,
    private onError: (error: WebRTCError) => void
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.connectionManager.setConnectionStateChangeHandler((state: RTCPeerConnectionState) => {
      console.log('[CONNECTION] State changed:', state);
      
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        console.log('[CONNECTION] Peer disconnected, cleaning up connection state');
        this.handleDisconnect();
      } else if (state === 'connected') {
        console.log('[CONNECTION] Connection established, resetting reconnect attempts');
        this.reconnectAttempts = 0;
      } else if (!this.isDisconnecting && this.connectionStateListener) {
        this.connectionStateListener(state);
      }
    });

    this.dataChannelManager.setStateChangeHandler((state: RTCDataChannelState) => {
      console.log('[DATACHANNEL] State changed:', state);
      if (state === 'closed' || state === 'closing') {
        console.log('[DATACHANNEL] Channel closed/closing, initiating disconnect');
        this.handleDisconnect();
      }
    });
  }

  setConnectionStateListener(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateListener = handler;
  }

  handleDisconnect() {
    if (this.isDisconnecting) return;
    this.isDisconnecting = true;

    // Immediately notify of disconnection
    if (this.connectionStateListener) {
      console.log('[CONNECTION] Forcing immediate disconnect state');
      this.connectionStateListener('disconnected');
    }

    // Force the connection to close and cleanup
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();

    // Reset the disconnecting flag after cleanup
    setTimeout(() => {
      console.log('[CONNECTION] Resetting disconnect state');
      this.isDisconnecting = false;
    }, 100);
  }
}
