
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
      
      if ((state === 'disconnected' || state === 'failed' || state === 'closed') && !this.isDisconnecting) {
        console.log('[CONNECTION] Peer disconnected, cleaning up connection state');
        this.handleDisconnect();
      }
      
      if (this.connectionStateListener && !this.isDisconnecting) {
        this.connectionStateListener(state);
      }
    });

    this.dataChannelManager.setStateChangeHandler((state: RTCDataChannelState) => {
      console.log('[DATACHANNEL] State changed:', state);
      if (state === 'closed' && !this.isDisconnecting) {
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
        this.connectionStateListener('disconnected');
      }
    } finally {
      this.isDisconnecting = false;
    }
  }
}
