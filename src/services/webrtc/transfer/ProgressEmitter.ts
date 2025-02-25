
import type { TransferProgress } from '../types/transfer';

export class ProgressEmitter {
  private lastEmittedProgress: Map<string, TransferProgress> = new Map();
  private emitLock: boolean = false;
  private readonly EMIT_COOLDOWN = 16; // ~1 frame @ 60fps
  private readonly PROGRESS_THRESHOLD = 0.5; // Only emit if progress changed by 0.5%

  constructor(private onProgress?: (progress: TransferProgress) => void) {
    console.log('[PROGRESS] Initializing ProgressEmitter with callback:', !!this.onProgress);
  }

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
    if (!this.onProgress) {
      console.log('[PROGRESS] No progress handler registered');
      return;
    }

    console.log(`[PROGRESS] Emitting progress for ${filename}: ${progress?.loaded}/${progress?.total} (${status})`);

    if (this.emitLock) {
      console.log('[PROGRESS] Emit locked, skipping update');
      return;
    }

    try {
      this.emitLock = true;

      // Skip emission if this is an empty error state
      if (status === 'error' && !filename) {
        console.log('[PROGRESS] Skipping empty error state emission');
        return;
      }

      // For completion states, always emit
      if (progress?.loaded === progress?.total && progress?.total > 0) {
        console.log('[PROGRESS] Emitting completion state for:', filename);
        const completionState: TransferProgress = {
          status: 'transferring',
          filename,
          currentChunk: progress.totalChunks,
          totalChunks: progress.totalChunks,
          loaded: progress.total,
          total: progress.total,
          timestamp: Date.now()
        };
        
        // Call onProgress directly for important state changes
        this.onProgress(completionState);
        this.lastEmittedProgress.set(filename, completionState);
        return;
      }

      // For cancel states, emit immediately and clear state
      if (status === 'canceled_by_sender' || status === 'canceled_by_receiver') {
        console.log('[PROGRESS] Emitting cancellation state for:', filename);
        const cancelState: TransferProgress = {
          status,
          filename,
          currentChunk: 0,
          totalChunks: 0,
          loaded: 0,
          total: 0,
          timestamp: Date.now()
        };
        
        // Call onProgress directly for important state changes
        this.onProgress(cancelState);
        this.lastEmittedProgress.delete(filename);
        return;
      }

      // For all other states, check if we should emit based on progress change
      const lastProgress = this.lastEmittedProgress.get(filename);
      
      // Always emit for the first progress update of a file
      const isFirstUpdate = !lastProgress;
      
      // For normal updates, always send at least every 1 second regardless of progress amount
      let shouldEmitProgress = isFirstUpdate;
      
      if (!isFirstUpdate && progress) {
        // Calculate progress percentage for comparison
        const currentPercent = progress.loaded / progress.total;
        const lastPercent = lastProgress.loaded / lastProgress.total;
        
        // Emit if status changed, significant progress change, or time threshold exceeded
        shouldEmitProgress = 
          lastProgress.status !== status ||
          Math.abs(currentPercent - lastPercent) >= this.PROGRESS_THRESHOLD / 100 ||
          (Date.now() - (lastProgress.timestamp || 0) > 250); // More frequent updates
          
        console.log(`[PROGRESS] Progress change: ${(Math.abs(currentPercent - lastPercent) * 100).toFixed(2)}%, threshold: ${this.PROGRESS_THRESHOLD}%, should emit: ${shouldEmitProgress}`);
      }

      if (shouldEmitProgress || isFirstUpdate) {
        // Use callback directly without extra setTimeout
        console.log(`[PROGRESS] Emitting progress update - status: ${status}, filename: ${filename}, loaded: ${progress?.loaded}/${progress?.total}`);
        
        const progressUpdate: TransferProgress = {
          status,
          filename,
          currentChunk: progress?.currentChunk || 0,
          totalChunks: progress?.totalChunks || 0,
          loaded: progress?.loaded || 0,
          total: progress?.total || 0,
          timestamp: Date.now()
        };

        // Direct callback for immediate update
        this.onProgress(progressUpdate);
        this.lastEmittedProgress.set(filename, progressUpdate);
      } else {
        console.log(`[PROGRESS] Skipping progress update - small change or too frequent`);
      }
    } catch (error) {
      console.error('[PROGRESS] Error in progress emission:', error);
    } finally {
      // Release the lock immediately to prevent update buildup
      this.emitLock = false;
    }
  }

  reset(filename?: string) {
    console.log(`[PROGRESS] Resetting progress emitter${filename ? ` for ${filename}` : ''}`);
    if (filename) {
      this.lastEmittedProgress.delete(filename);
    } else {
      this.lastEmittedProgress.clear();
    }
    this.emitLock = false;
  }
}
