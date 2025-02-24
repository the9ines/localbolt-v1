
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';

export class WebRTCRetryHandler {
  private connectionAttempts: number = 0;
  private readonly maxConnectionAttempts: number = 3;

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

  private async retryConnection(remotePeerCode: string) {
    console.log('[WEBRTC] Retrying connection, attempt:', this.connectionAttempts);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
