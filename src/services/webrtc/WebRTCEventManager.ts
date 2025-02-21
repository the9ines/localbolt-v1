
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './types/transfer';
import { ConnectionManager } from './ConnectionManager';
import { DataChannelManager } from './DataChannelManager';

export class WebRTCEventManager {
  private connectionStateListener?: (state: RTCPeerConnectionState) => void;
  private isDisconnecting: boolean = false;
  private disconnectTimeout: NodeJS.Timeout | null = null;

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
      } else if (!this.isDisconnecting) {
        if (this.connectionStateListener) {
          this.connectionStateListener(state);
        }
      }
    });

    this.dataChannelManager.setStateChangeHandler((state: RTCDataChannelState) => {
      console.log('[DATACHANNEL] State changed:', state);
      if (state === 'closed') {
        console.log('[DATACHANNEL] Channel closed, initiating disconnect');
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

    // Clear any existing timeout
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
    }
    
    try {
      // Ensure we always notify of disconnection
      if (this.connectionStateListener) {
        this.connectionStateListener('disconnected');
      }
    } finally {
      // Set a new timeout with increased duration
      this.disconnectTimeout = setTimeout(() => {
        this.isDisconnecting = false;
        this.disconnectTimeout = null;
      }, 1000); // Increased timeout to ensure all disconnect events are processed
    }
  }
}
