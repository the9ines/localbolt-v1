
import type { TransferProgress } from '../types/transfer';
import { WebRTCError } from '@/types/webrtc-errors';
import { ConnectionStateHandler } from '../handlers/ConnectionStateHandler';

export class WebRTCStateManager {
  private remotePeerCode: string = '';
  private onProgressCallback?: (progress: TransferProgress) => void;

  constructor(
    private connectionStateHandler: ConnectionStateHandler,
    private onError: (error: WebRTCError) => void,
    onProgress?: (progress: TransferProgress) => void
  ) {
    this.onProgressCallback = onProgress;
  }

  setRemotePeerCode(code: string) {
    this.remotePeerCode = code;
  }

  getRemotePeerCode(): string {
    return this.remotePeerCode;
  }

  clearRemotePeerCode() {
    this.remotePeerCode = '';
  }

  handleConnectionStateChange(state: RTCPeerConnectionState) {
    console.log('[WEBRTC] Connection state change:', state);
    if (state === 'connected') {
      this.connectionStateHandler.handleConnectionStateChange(state, this.remotePeerCode);
    } else {
      this.connectionStateHandler.handleConnectionStateChange(state, this.remotePeerCode);
    }
  }

  handleDisconnection() {
    console.log('[WEBRTC] Disconnecting due to peer disconnect signal');
    this.connectionStateHandler.handleDisconnection();
    this.clearRemotePeerCode();
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.onProgressCallback = callback;
  }

  updateProgress(progress: TransferProgress) {
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }

  handleError(error: WebRTCError) {
    this.onError(error);
  }
}
