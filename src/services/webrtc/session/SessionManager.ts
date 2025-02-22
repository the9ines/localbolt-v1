
import type { TransferProgress } from '../types/transfer';
import { WebRTCError } from '@/types/webrtc-errors';

export class SessionManager {
  private isConnectionInProgress: boolean = false;
  private connectionPromise?: Promise<void>;
  private connectionTimeoutId?: NodeJS.Timeout;
  private remotePeerCode: string = '';
  private isInitiator: boolean = false;

  constructor(private onError: (error: WebRTCError) => void) {}

  isConnecting(): boolean {
    return this.isConnectionInProgress;
  }

  getCurrentPromise(): Promise<void> | undefined {
    return this.connectionPromise;
  }

  setConnectionPromise(promise: Promise<void>) {
    this.connectionPromise = promise;
  }

  startConnection() {
    this.isConnectionInProgress = true;
  }

  endConnection() {
    this.isConnectionInProgress = false;
    this.connectionPromise = undefined;
  }

  setConnectionTimeout(callback: () => void, timeout: number) {
    this.clearConnectionTimeout();
    this.connectionTimeoutId = setTimeout(callback, timeout);
  }

  clearConnectionTimeout() {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = undefined;
    }
  }

  setRemotePeerCode(code: string) {
    this.remotePeerCode = code;
  }

  getRemotePeerCode(): string {
    return this.remotePeerCode;
  }

  setInitiator(isInitiator: boolean) {
    this.isInitiator = isInitiator;
  }

  isInitiatorPeer(): boolean {
    return this.isInitiator;
  }

  reset() {
    this.isConnectionInProgress = false;
    this.connectionPromise = undefined;
    this.clearConnectionTimeout();
    this.remotePeerCode = '';
    this.isInitiator = false;
  }
}
