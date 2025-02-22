
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
      
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        console.log('[CONNECTION] Peer disconnected, cleaning up connection state');
        this.forceDisconnect();
      } else if (!this.isDisconnecting && this.connectionStateListener) {
        this.connectionStateListener(state);
      }
    });

    this.dataChannelManager.setStateChangeHandler((state: RTCDataChannelState) => {
      console.log('[DATACHANNEL] State changed:', state);
      if (state === 'closed' || state === 'closing') {
        console.log('[DATACHANNEL] Channel closed/closing, initiating disconnect');
        this.forceDisconnect();
      }
    });
  }

  setConnectionStateListener(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateListener = handler;
  }

  private forceDisconnect() {
    if (this.isDisconnecting) return;
    this.isDisconnecting = true;

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
    }, 100);
  }

  handleDisconnect() {
    this.forceDisconnect();
  }
}
