
import { ConnectionError } from '@/types/webrtc-errors';
import type { ConnectionState } from '../types/connection-state';

export class ConnectionStateHandler {
  private connectionState: ConnectionState = {
    isConnected: false,
    lastConnectedAt: null,
    reconnectAttempts: 0,
    lastError: null,
    candidateCache: new Map()
  };

  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY = 2000; // 2 seconds
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    private onReconnectNeeded: () => Promise<void>,
    private onConnectionStateChange: (state: RTCPeerConnectionState) => void
  ) {}

  async handleConnectionStateChange(state: RTCPeerConnectionState): Promise<void> {
    console.log('[CONNECTION] State changed to:', state);
    this.onConnectionStateChange(state);

    switch (state) {
      case 'connected':
        this.handleConnectedState();
        break;
      case 'disconnected':
      case 'failed':
        await this.handleDisconnectedState();
        break;
      case 'closed':
        this.handleClosedState();
        break;
    }
  }

  private handleConnectedState(): void {
    this.connectionState = {
      ...this.connectionState,
      isConnected: true,
      lastConnectedAt: Date.now(),
      reconnectAttempts: 0,
      lastError: null
    };
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private async handleDisconnectedState(): Promise<void> {
    this.connectionState.isConnected = false;

    if (this.connectionState.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[CONNECTION] Max reconnection attempts reached');
      this.handleClosedState();
      throw new ConnectionError('Maximum reconnection attempts reached');
    }

    if (!this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(async () => {
        try {
          this.connectionState.reconnectAttempts++;
          console.log(`[CONNECTION] Attempting reconnection (${this.connectionState.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
          await this.onReconnectNeeded();
        } catch (error) {
          console.error('[CONNECTION] Reconnection attempt failed:', error);
          this.connectionState.lastError = error as Error;
          await this.handleDisconnectedState();
        }
      }, this.RECONNECT_DELAY);
    }
  }

  private handleClosedState(): void {
    this.connectionState = {
      isConnected: false,
      lastConnectedAt: this.connectionState.lastConnectedAt,
      reconnectAttempts: 0,
      lastError: this.connectionState.lastError,
      candidateCache: new Map()
    };

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  cacheIceCandidate(candidate: RTCIceCandidate): void {
    const key = `${candidate.sdpMLineIndex}-${candidate.candidate}`;
    this.connectionState.candidateCache.set(key, candidate);
  }

  getCachedCandidates(): RTCIceCandidate[] {
    return Array.from(this.connectionState.candidateCache.values());
  }

  reset(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.connectionState = {
      isConnected: false,
      lastConnectedAt: null,
      reconnectAttempts: 0,
      lastError: null,
      candidateCache: new Map()
    };
  }

  getState(): ConnectionState {
    return { ...this.connectionState };
  }
}
