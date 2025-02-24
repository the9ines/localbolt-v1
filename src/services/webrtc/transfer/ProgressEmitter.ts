
import type { TransferProgress } from '../types/transfer';

export class ProgressEmitter {
  constructor(private onProgress?: (progress: TransferProgress) => void) {}

  emit(
    filename: string,
    status: 'transferring' | 'paused' | 'canceled_by_sender' | 'canceled_by_receiver' | 'error',
    progress?: {
      loaded: number;
      total: number;
      currentChunk: number;
      totalChunks: number;
    }
  ) {
    if (this.onProgress) {
      try {
        console.log(`[STATE] Emitting progress update - status: ${status}, filename: ${filename}`);
        this.onProgress({
          status,
          filename,
          currentChunk: progress?.currentChunk || 0,
          totalChunks: progress?.totalChunks || 0,
          loaded: progress?.loaded || 0,
          total: progress?.total || 0,
          sending: false
        });
      } catch (error) {
        console.error('[STATE] Error in progress callback:', error);
      }
    }
  }
}
