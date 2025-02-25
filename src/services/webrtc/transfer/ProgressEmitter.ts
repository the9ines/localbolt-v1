
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
    // Always log the attempt to emit progress
    console.log(`[PROGRESS] Attempting to emit progress for ${filename}: ${progress?.loaded}/${progress?.total} (${status})`);
    
    if (!this.onProgress) {
      console.log('[PROGRESS] No progress handler registered, skipping update');
      return;
    }

    // Don't use emitLock - it's causing updates to be skipped
    // Removed lock to ensure all updates get through
    
    try {
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

      // For normal progress updates - send more updates
      // IMPORTANT: Reduced filtering to ensure more updates reach the UI
      const progressUpdate: TransferProgress = {
        status,
        filename,
        currentChunk: progress?.currentChunk || 0,
        totalChunks: progress?.totalChunks || 0,
        loaded: progress?.loaded || 0,
        total: progress?.total || 0,
        timestamp: Date.now()
      };

      // For normal updates, send them more frequently
      const lastProgress = this.lastEmittedProgress.get(filename);
      const isFirstUpdate = !lastProgress;
      
      // Calculate if we should send this update
      let shouldEmitProgress = isFirstUpdate;
      
      if (!isFirstUpdate && progress) {
        // Calculate progress percentage for comparison
        const currentPercent = progress.loaded / progress.total;
        const lastPercent = lastProgress.loaded / lastProgress.total;
        
        // Send more frequent updates by lowering the threshold
        shouldEmitProgress = 
          lastProgress.status !== status ||
          Math.abs(currentPercent - lastPercent) >= 0.002 || // 0.2% is enough to update
          (Date.now() - (lastProgress.timestamp || 0) > 100); // Update at least every 100ms
          
        console.log(`[PROGRESS] Progress change: ${(Math.abs(currentPercent - lastPercent) * 100).toFixed(2)}%, should emit: ${shouldEmitProgress}`);
      }

      if (shouldEmitProgress || isFirstUpdate) {
        console.log(`[PROGRESS] Emitting progress update: ${filename}, ${progress?.loaded}/${progress?.total}`);
        
        // Always invoke callback directly
        this.onProgress(progressUpdate);
        this.lastEmittedProgress.set(filename, progressUpdate);
      } else {
        console.log(`[PROGRESS] Skipping this update - too small or too frequent`);
      }
    } catch (error) {
      console.error('[PROGRESS] Error in progress emission:', error);
    }
  }

  reset(filename?: string) {
    console.log(`[PROGRESS] Resetting progress emitter${filename ? ` for ${filename}` : ''}`);
    if (filename) {
      this.lastEmittedProgress.delete(filename);
    } else {
      this.lastEmittedProgress.clear();
    }
  }
}
