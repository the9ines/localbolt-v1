import { WebRTCError } from '@/types/webrtc-errors';
import { ConnectionManager } from './ConnectionManager';
import { DataChannelManager } from './DataChannelManager';
import { ConnectionQualityMonitor } from './monitoring/ConnectionQualityMonitor';
import type { ConnectionQuality } from './types/connection-quality';

export class WebRTCEventManager {
  private connectionStateListener?: (state: RTCPeerConnectionState) => void;
  private qualityChangeListener?: (quality: ConnectionQuality) => void;
  private isDisconnecting: boolean = false;
  private qualityMonitor?: ConnectionQualityMonitor;

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
      
      if (state === 'connected') {
        this.setupQualityMonitoring();
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        console.log('[CONNECTION] Peer disconnected, cleaning up connection state');
        this.stopQualityMonitoring();
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

  private setupQualityMonitoring() {
    const peerConnection = this.connectionManager.getPeerConnection();
    if (!peerConnection) return;

    this.qualityMonitor = new ConnectionQualityMonitor(
      peerConnection,
      (quality) => {
        console.log('[MONITOR] Connection quality changed:', quality);
        if (this.qualityChangeListener) {
          this.qualityChangeListener(quality);
        }
      },
      (metrics) => {
        console.log('[MONITOR] Metrics updated:', metrics);
      }
    );

    this.qualityMonitor.startMonitoring();
  }

  private stopQualityMonitoring() {
    if (this.qualityMonitor) {
      this.qualityMonitor.stopMonitoring();
      this.qualityMonitor = undefined;
    }
  }

  setConnectionStateListener(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateListener = handler;
    if (this.connectionManager.getPeerConnection()) {
      handler(this.connectionManager.getPeerConnection()!.connectionState);
    }
  }

  setQualityChangeListener(handler: (quality: ConnectionQuality) => void) {
    this.qualityChangeListener = handler;
  }

  private forceDisconnect() {
    if (this.isDisconnecting) return;
    this.isDisconnecting = true;

    this.stopQualityMonitoring();

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
