
import { TimeoutError, TransferError } from '@/types/webrtc-errors';
import type { TransferProgress } from '../../types/transfer';

export class RetryHandler {
  private retryAttempts: Map<string, number> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 1000; // 1 second

  constructor(
    private onRetry: (chunkIndex: number, filename: string) => Promise<void>,
    private onError: (error: TransferError) => void,
    private updateProgress: (progress: TransferProgress) => void
  ) {
    console.log('[RETRY] Initializing RetryHandler');
  }

  async handleFailedChunk(
    chunkIndex: number,
    filename: string,
    error: Error
  ): Promise<boolean> {
    console.log(`[RETRY] Handling failed chunk ${chunkIndex} for ${filename}`);
    
    const attempts = this.retryAttempts.get(filename) || 0;
    
    if (attempts >= this.MAX_RETRIES) {
      console.log(`[RETRY] Max retries reached for ${filename}`);
      this.onError(new TransferError(
        `Failed to transfer chunk after ${this.MAX_RETRIES} attempts`,
        { chunkIndex, filename, originalError: error }
      ));
      return false;
    }

    // Increment retry counter
    this.retryAttempts.set(filename, attempts + 1);
    
    // Calculate delay with exponential backoff
    const delay = this.BASE_DELAY * Math.pow(2, attempts);
    console.log(`[RETRY] Scheduling retry in ${delay}ms for ${filename}`);

    try {
      // Update progress to show retry status
      this.updateProgress({
        filename,
        status: 'transferring',
        currentChunk: chunkIndex,
        totalChunks: 0,
        loaded: 0,
        total: 0,
        stats: {
          retryCount: attempts + 1,
          maxRetries: this.MAX_RETRIES,
          startTime: Date.now(),
          speed: 0,
          averageSpeed: 0,
          estimatedTimeRemaining: 0,
          pauseDuration: 0
        }
      });

      // Schedule retry
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(async () => {
          console.log(`[RETRY] Attempting retry for chunk ${chunkIndex} of ${filename}`);
          try {
            await this.onRetry(chunkIndex, filename);
            resolve(null);
          } catch (retryError) {
            reject(retryError);
          }
        }, delay);

        this.retryTimeouts.set(filename, timeout);
      });

      console.log(`[RETRY] Successfully retried chunk ${chunkIndex} for ${filename}`);
      return true;
    } catch (retryError) {
      console.error(`[RETRY] Failed retry for chunk ${chunkIndex} of ${filename}:`, retryError);
      
      if (attempts + 1 >= this.MAX_RETRIES) {
        this.onError(new TransferError(
          `Retry failed after ${this.MAX_RETRIES} attempts`,
          { chunkIndex, filename, originalError: retryError }
        ));
        return false;
      }
      
      // Try again if we haven't hit max retries
      return this.handleFailedChunk(chunkIndex, filename, retryError as Error);
    }
  }

  cancelRetries(filename: string) {
    console.log(`[RETRY] Cancelling retries for ${filename}`);
    const timeout = this.retryTimeouts.get(filename);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(filename);
    }
    this.retryAttempts.delete(filename);
  }

  reset() {
    console.log('[RETRY] Resetting retry handler');
    this.retryTimeouts.forEach(clearTimeout);
    this.retryTimeouts.clear();
    this.retryAttempts.clear();
  }
}
