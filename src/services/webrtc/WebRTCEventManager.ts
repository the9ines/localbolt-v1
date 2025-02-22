
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './types/transfer';
import { ConnectionManager } from './ConnectionManager';
import { DataChannelManager } from './DataChannelManager';

export class WebRTCEventManager {
  private connectionStateListener?: (state: RTCPeerConnectionState) => void;
  private isDisconnecting: boolean = false;
  private connectionStabilityTimeout: number | null = null;
  private lastConnectionState: RTCPeerConnectionState = 'new';

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
      
      // Clear any existing stability timeout
      if (this.connectionStabilityTimeout !== null) {
        window.clearTimeout(this.connectionStabilityTimeout);
        this.connectionStabilityTimeout = null;
      }

      if (state === 'connected' && this.lastConnectionState !== 'connected') {
        // Wait for connection to stabilize before confirming connected state
        this.connectionStabilityTimeout = window.setTimeout(() => {
          console.log('[CONNECTION] Connection stabilized');
          if (this.connectionStateListener && !this.isDisconnecting) {
            this.lastConnectionState = state;
            this.connectionStateListener(state);
          }
        }, 1000);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        console.log('[CONNECTION] Peer disconnected, cleaning up connection state');
        // Only force disconnect if it wasn't already disconnecting
        if (!this.isDisconnecting) {
          this.forceDisconnect();
        }
      }

      this.lastConnectionState = state;
    });

    this.dataChannelManager.setStateChangeHandler((state: RTCDataChannelState) => {
      console.log('[DATACHANNEL] State changed:', state);
      if ((state === 'closed' || state === 'closing') && !this.isDisconnecting) {
        console.log('[DATACHANNEL] Channel closed/closing, initiating disconnect');
        this.forceDisconnect();
      }
    });
  }

  setConnectionStateListener(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateListener = handler;
    // If we already have a stable connection, notify immediately
    if (this.lastConnectionState === 'connected' && !this.isDisconnecting) {
      handler(this.lastConnectionState);
    }
  }

  private forceDisconnect() {
    if (this.isDisconnecting) return;
    this.isDisconnecting = true;

    // Clear any pending stability timeout
    if (this.connectionStabilityTimeout !== null) {
      window.clearTimeout(this.connectionStabilityTimeout);
      this.connectionStabilityTimeout = null;
    }

    // Immediately notify of disconnection
    if (this.connectionStateListener) {
      console.log('[CONNECTION] Forcing immediate disconnect state');
      this.connectionStateListener('disconnected');
    }

    // Force the connection to close
    this.connectionManager.disconnect();
    this.dataChannelManager.disconnect();

    // Reset the disconnecting flag after all cleanup
    setTimeout(() => {
      console.log('[CONNECTION] Resetting disconnect state');
      this.isDisconnecting = false;
    }, 1000);
  }

  handleDisconnect() {
    this.forceDisconnect();
  }
}
