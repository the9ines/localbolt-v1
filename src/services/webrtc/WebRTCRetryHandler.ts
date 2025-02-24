
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';

export class WebRTCRetryHandler {
  private connectionAttempts: number = 0;
  private readonly maxConnectionAttempts: number = 3;
  private readonly initialRetryDelay: number = 1000; // 1 second
  private readonly maxRetryDelay: number = 10000; // 10 seconds
  private retryTimeout?: NodeJS.Timeout;

  constructor(
    private onError: (error: WebRTCError) => void,
    private connect: (remotePeerCode: string) => Promise<void>
  ) {}

  async handleError(error: WebRTCError, remotePeerCode: string) {
    console.error(`[${error.name}]`, error.message, error.details);
    
    if (error instanceof ConnectionError && this.connectionAttempts < this.maxConnectionAttempts) {
      console.log('[WEBRTC] Connection failed, attempting retry...');
      this.connectionAttempts++;
      await this.retryConnection(remotePeerCode);
    } else {
      this.onError(error);
    }
  }

  private calculateRetryDelay(): number {
    // Exponential backoff: 1s, 2s, 4s, etc. up to maxRetryDelay
    const delay = Math.min(
      this.initialRetryDelay * Math.pow(2, this.connectionAttempts - 1),
      this.maxRetryDelay
    );
    console.log(`[WEBRTC] Calculated retry delay: ${delay}ms (attempt ${this.connectionAttempts})`);
    return delay;
  }

  private async retryConnection(remotePeerCode: string) {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    const delay = this.calculateRetryDelay();
    console.log(`[WEBRTC] Retrying connection in ${delay}ms, attempt: ${this.connectionAttempts}`);
    
    return new Promise<void>((resolve) => {
      this.retryTimeout = setTimeout(async () => {
        try {
          await this.connect(remotePeerCode);
          console.log('[WEBRTC] Retry connection successful');
          resolve();
        } catch (error) {
          console.log('[WEBRTC] Retry connection failed');
          await this.handleError(error as WebRTCError, remotePeerCode);
          resolve();
        }
      }, delay);
    });
  }

  resetAttempts() {
    console.log('[WEBRTC] Resetting connection attempts');
    this.connectionAttempts = 0;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  cleanup() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    this.resetAttempts();
  }
}
