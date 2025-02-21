
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './types/transfer';
import { ConnectionManager } from './ConnectionManager';
import { DataChannelManager } from './DataChannelManager';

export class WebRTCEventManager {
  private connectionStateListener?: (state: RTCPeerConnectionState) => void;
  private isDisconnecting: boolean = false;

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
      
      // If we're disconnecting or already in a disconnected state, ensure we notify the UI
      if ((state === 'disconnected' || state === 'failed' || state === 'closed')) {
        console.log('[CONNECTION] Peer disconnected, cleaning up connection state');
        this.handleDisconnect();
        return; // Don't process further state changes during disconnect
      }
      
      if (this.connectionStateListener && !this.isDisconnecting) {
        this.connectionStateListener(state);
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
    
    try {
      if (this.connectionStateListener) {
        // Always notify UI of disconnection
        this.connectionStateListener('disconnected');
      }
    } finally {
      setTimeout(() => {
        this.isDisconnecting = false;
      }, 100); // Small delay to ensure all disconnect events are processed
    }
  }
}
