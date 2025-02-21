
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';

export class WebRTCRetryHandler {
  private connectionAttempts: number = 0;
  private readonly maxConnectionAttempts: number = 3;
  private readonly maxRetryDelay: number = 5000; // 5 seconds
  private readonly initialRetryDelay: number = 1000; // 1 second

  constructor(
    private onError: (error: WebRTCError) => void,
    private connect: (remotePeerCode: string) => Promise<void>
  ) {}

  async handleError(error: WebRTCError, remotePeerCode: string) {
    console.error(`[${error.name}]`, error.message, error.details);
    
    if (this.shouldRetry(error)) {
      console.log('[WEBRTC] Connection failed, attempting retry...');
      this.connectionAttempts++;
      await this.retryConnection(remotePeerCode);
    } else {
      this.onError(error);
    }
  }

  private shouldRetry(error: WebRTCError): boolean {
    // Retry on connection errors and when under max attempts
    if (!(error instanceof ConnectionError)) return false;
    if (this.connectionAttempts >= this.maxConnectionAttempts) return false;
    
    // Don't retry on certain error codes
    const nonRetryableCodes = [
      'UNAUTHORIZED',
      'INVALID_PEER_CODE',
      'ENCRYPTION_ERROR'
    ];
    
    return !nonRetryableCodes.includes(error.code);
  }

  calculateRetryDelay(): number {
    // Exponential backoff with jitter
    const exponentialDelay = this.initialRetryDelay * Math.pow(2, this.connectionAttempts - 1);
    const jitter = Math.random() * 1000; // Random delay between 0-1000ms
    return Math.min(exponentialDelay + jitter, this.maxRetryDelay);
  }

  private async retryConnection(remotePeerCode: string) {
    const delay = this.calculateRetryDelay();
    console.log(`[WEBRTC] Retrying connection in ${delay}ms, attempt: ${this.connectionAttempts}`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.connect(remotePeerCode);
    } catch (error) {
      await this.handleError(error as WebRTCError, remotePeerCode);
    }
  }

  resetAttempts() {
    this.connectionAttempts = 0;
  }
}
