
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';

export class NetworkManager {
  private networkStateHandler?: (isOnline: boolean) => void;

  constructor(
    private onError: (error: WebRTCError) => void,
    private handleTransferPause: () => void,
    private handleTransferResume: () => void
  ) {
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    const handleNetworkChange = () => {
      const isOnline = navigator.onLine;
      console.log('[NETWORK] Connection status changed:', isOnline ? 'online' : 'offline');
      
      if (!isOnline) {
        this.handleOfflineMode();
      } else {
        this.handleOnlineMode();
      }
      
      if (this.networkStateHandler) {
        this.networkStateHandler(isOnline);
      }
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
  }

  private handleOfflineMode() {
    console.log('[NETWORK] Switching to offline mode');
    this.handleTransferPause();
    this.onError(new ConnectionError(
      "Network connection lost",
      { detail: "Transfer paused due to network loss. Will resume when connection is restored." }
    ));
  }

  private handleOnlineMode() {
    console.log('[NETWORK] Switching to online mode');
    this.handleTransferResume();
  }

  setNetworkStateHandler(handler: (isOnline: boolean) => void) {
    this.networkStateHandler = handler;
  }

  checkNetworkStatus(): boolean {
    return navigator.onLine;
  }
}
