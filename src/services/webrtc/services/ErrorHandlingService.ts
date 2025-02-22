
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { WebRTCRetryHandler } from '../WebRTCRetryHandler';

export class ErrorHandlingService {
  constructor(
    private onError: (error: WebRTCError) => void,
    private retryHandler: WebRTCRetryHandler
  ) {}

  handleError(error: WebRTCError, remotePeerCode?: string) {
    console.error(`[${error.name}]`, error.message, error.details);
    
    if (remotePeerCode) {
      this.retryHandler.handleError(error, remotePeerCode);
    } else {
      this.onError(error);
    }
  }

  resetRetryAttempts() {
    this.retryHandler.resetAttempts();
  }
}
