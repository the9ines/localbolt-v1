
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
        return; // Prevent any other state updates during disconnect
      }

      // Only update state if we're not in the process of disconnecting
      if (!this.isDisconnecting && this.connectionStateListener) {
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

    // Clear any existing timeout
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
    }
    
    // Force immediate disconnect state notification
    if (this.connectionStateListener) {
      console.log('[CONNECTION] Forcing disconnect state notification');
      this.connectionStateListener('disconnected');
      
      // Double-check disconnect state after a brief delay
      setTimeout(() => {
        if (this.connectionStateListener) {
          this.connectionStateListener('disconnected');
        }
      }, 50);
    }

    // Reset disconnecting flag after a longer delay
    this.disconnectTimeout = setTimeout(() => {
      console.log('[CONNECTION] Resetting disconnect state');
      this.isDisconnecting = false;
      this.disconnectTimeout = null;

      // Final disconnect state check
      if (this.connectionStateListener) {
        this.connectionStateListener('disconnected');
      }
    }, 1500);
  }
}
