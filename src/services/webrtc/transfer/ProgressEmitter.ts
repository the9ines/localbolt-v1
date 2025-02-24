
import type { TransferProgress } from '../types/transfer';

export class ProgressEmitter {
  private lastEmittedProgress: TransferProgress | null = null;

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
    if (!this.onProgress) return;

    try {
      // Don't emit empty error states after successful completion
      if (status === 'error' && !filename && (!progress || progress.total === 0)) {
        console.log('[STATE] Skipping empty error state emission');
        return;
      }

      // For completion states, ensure we emit success
      if (progress?.loaded === progress?.total && progress?.total > 0) {
        console.log('[STATE] Emitting completion state for:', filename);
        this.lastEmittedProgress = {
          status: 'transferring',
          filename,
          ...progress
        };
        this.onProgress(this.lastEmittedProgress);
        return;
      }

      console.log(`[STATE] Emitting progress update - status: ${status}, filename: ${filename}`);
      
      this.lastEmittedProgress = {
        status,
        filename,
        currentChunk: progress?.currentChunk || 0,
        totalChunks: progress?.totalChunks || 0,
        loaded: progress?.loaded || 0,
        total: progress?.total || 0,
      };

      this.onProgress(this.lastEmittedProgress);
    } catch (error) {
      console.error('[STATE] Error in progress callback:', error);
    }
  }
}
