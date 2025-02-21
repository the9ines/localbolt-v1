
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { ConnectionManager } from '../ConnectionManager';
import type { TransferProgress } from '../types/transfer';

export class ConnectionStateManager {
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;
  private retryCallback?: () => Promise<void>;

  constructor(
    private connectionManager: ConnectionManager,
    private onError: (error: WebRTCError) => void,
    private onConnectionStateChange: (state: RTCPeerConnectionState) => void
  ) {}

  async retryConnection(connect: () => Promise<void>) {
    console.log('[WEBRTC] Retrying connection, attempt:', this.connectionAttempts);
    this.retryCallback = connect; // Store the callback for retries
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      await connect();
    } catch (error) {
      this.handleError(error as WebRTCError);
    }
  }

  handleError(error: WebRTCError) {
    console.error(`[${error.name}]`, error.message, error.details);
    
    if (error instanceof ConnectionError && this.connectionAttempts < this.maxConnectionAttempts) {
      console.log('[WEBRTC] Connection failed, attempting retry...');
      this.connectionAttempts++;
      if (this.retryCallback) {
        this.retryConnection(this.retryCallback);
      }
    } else {
      this.onError(error);
    }
  }

  resetConnectionAttempts() {
    this.connectionAttempts = 0;
    this.retryCallback = undefined;
  }

  getConnectionAttempts() {
    return this.connectionAttempts;
  }
}
