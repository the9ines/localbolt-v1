
import type { TransferProgress } from '../types/transfer';

export class ProgressEmitter {
  private lastEmittedProgress: TransferProgress | null = null;
  private emitLock: boolean = false;
  private readonly EMIT_COOLDOWN = 16; // ~1 frame @ 60fps

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
    if (!this.onProgress || this.emitLock) return;

    try {
      this.emitLock = true;

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
        
        // Prevent duplicate completion states
        if (JSON.stringify(this.lastEmittedProgress) !== JSON.stringify(completionState)) {
          this.onProgress(completionState);
          this.lastEmittedProgress = completionState;
        }
        return;
      }

      // For cancel states, emit immediately without progress data
      if (status === 'canceled_by_sender' || status === 'canceled_by_receiver') {
        const cancelState: TransferProgress = {
          status,
          filename,
          currentChunk: 0,
          totalChunks: 0,
          loaded: 0,
          total: 0
        };
        
        this.onProgress(cancelState);
        this.lastEmittedProgress = null;
        return;
      }

      // For all other states, debounce updates
      setTimeout(() => {
        if (!this.onProgress) return;

        console.log(`[STATE] Emitting progress update - status: ${status}, filename: ${filename}`);
        const progressUpdate: TransferProgress = {
          status,
          filename,
          currentChunk: progress?.currentChunk || 0,
          totalChunks: progress?.totalChunks || 0,
          loaded: progress?.loaded || 0,
          total: progress?.total || 0
        };

        // Only emit if the progress has actually changed
        if (JSON.stringify(this.lastEmittedProgress) !== JSON.stringify(progressUpdate)) {
          this.onProgress(progressUpdate);
          this.lastEmittedProgress = progressUpdate;
        }
      }, this.EMIT_COOLDOWN);

    } finally {
      setTimeout(() => {
        this.emitLock = false;
      }, this.EMIT_COOLDOWN);
    }
  }
}
