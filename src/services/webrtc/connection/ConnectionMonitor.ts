
import { ConnectionError } from '@/types/webrtc-errors';
import { ConnectionManager } from '../ConnectionManager';

export class ConnectionMonitor {
  private connectionCheckInterval: number | null = null;

  constructor(
    private connectionManager: ConnectionManager,
    private onError: (error: ConnectionError) => void,
    private onDisconnect: () => void
  ) {}

  startMonitoring(isTransferInProgress: boolean) {
    this.connectionCheckInterval = window.setInterval(() => {
      const peerConnection = this.connectionManager.getPeerConnection();
      if (peerConnection && isTransferInProgress) {
        console.log('[CONNECTION-CHECK] State:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
          console.log('[CONNECTION-CHECK] Connection lost during transfer');
          this.onDisconnect();
        }
      }
    }, 5000);
  }

  stopMonitoring() {
    if (this.connectionCheckInterval !== null) {
      window.clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }
}
