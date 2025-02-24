
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
      // Skip emission if this is an empty error state
      if (status === 'error' && !filename) {
        console.log('[STATE] Skipping empty error state emission');
        return;
      }

      // For completion states, always emit as 'transferring' with final progress
      if (progress?.loaded === progress?.total && progress?.total > 0) {
        console.log('[STATE] Emitting completion state for:', filename);
        const completionState: TransferProgress = {
          status: 'transferring',
          filename,
          currentChunk: progress.totalChunks,
          totalChunks: progress.totalChunks,
          loaded: progress.total,
          total: progress.total
        };
        this.onProgress(completionState);
        return;
      }

      // For all other states, emit as normal
      console.log(`[STATE] Emitting progress update - status: ${status}, filename: ${filename}`);
      const progressUpdate: TransferProgress = {
        status,
        filename,
        currentChunk: progress?.currentChunk || 0,
        totalChunks: progress?.totalChunks || 0,
        loaded: progress?.loaded || 0,
        total: progress?.total || 0
      };
      
      this.onProgress(progressUpdate);
    } catch (error) {
      console.error('[STATE] Error in progress callback:', error);
    }
  }
}
