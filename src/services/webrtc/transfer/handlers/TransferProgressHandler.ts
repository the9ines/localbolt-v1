
import type { TransferState } from '../../types/transfer-control';
import type { TransferStats } from '../../types/transfer';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferProgressHandler {
  private lastProgressUpdate: Map<string, number> = new Map();
  private transferStats: Map<string, TransferStats> = new Map();
  private readonly UPDATE_THRESHOLD_MS = 16; // Reduced from 50ms to match UI refresh rate
  private readonly SPEED_CALCULATION_WINDOW = 5000;

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {}

  updateProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number
  ) {
    try {
      const now = Date.now();
      const lastUpdate = this.lastProgressUpdate.get(filename) || 0;
      const isFirst = !this.lastProgressUpdate.has(filename);
      const isComplete = loaded === total && total > 0;
      
      console.log(`[PROGRESS-HANDLER] Processing update for ${filename}:`, {
        loaded,
        total,
        currentChunk,
        totalChunks,
        isFirst,
        isComplete,
        timeSinceLastUpdate: now - lastUpdate
      });

      // Always process first update, completion, or if enough time has passed
      if (!isFirst && !isComplete && now - lastUpdate < this.UPDATE_THRESHOLD_MS) {
        console.log('[PROGRESS-HANDLER] Skipping update due to throttling');
        return;
      }
      
      this.lastProgressUpdate.set(filename, now);
      
      const transfer = this.store.getTransfer(filename);
      if (!transfer) {
        console.warn(`[PROGRESS-HANDLER] Cannot update progress: ${filename} not found in store`);
        return;
      }

      // Calculate transfer statistics
      const stats = this.calculateTransferStats(filename, loaded, total, now);
      
      // Create new progress object
      const progressUpdate = { 
        loaded, 
        total, 
        currentChunk, 
        totalChunks,
        lastUpdated: now,
        stats // Include stats in the progress update
      };
      
      // Update transfer progress in store
      transfer.progress = progressUpdate;
      this.store.setTransfer(transfer);

      // Update current transfer if this is the active one
      if (this.store.getCurrentTransfer()?.filename === filename) {
        console.log('[PROGRESS-HANDLER] Updating current transfer in store');
        this.store.updateState({ currentTransfer: transfer });
      }

      // Emit progress update with stats immediately
      console.log('[PROGRESS-HANDLER] Emitting progress update:', {
        filename,
        status: this.store.isPaused() ? 'paused' : 'transferring',
        loaded,
        total,
        currentChunk,
        totalChunks,
        stats
      });
      
      // Make sure we emit a progress update for EVERY chunk, regardless of throttling
      this.progressEmitter.emit(
        filename,
        this.store.isPaused() ? 'paused' : 'transferring',
        {
          loaded,
          total,
          currentChunk,
          totalChunks
        }
      );

      // Handle completion
      if (isComplete) {
        console.log(`[PROGRESS-HANDLER] Transfer completed for ${filename}`);
        this.cleanup(filename);
      }
    } catch (error) {
      console.error('[PROGRESS-HANDLER] Error updating progress:', error);
      this.cleanup(filename);
      throw error;
    }
  }

  private calculateTransferStats(
    filename: string,
    loaded: number,
    total: number,
    now: number
  ): TransferStats {
    let stats = this.transferStats.get(filename) || {
      speed: 0,
      averageSpeed: 0,
      estimatedTimeRemaining: 0,
      retryCount: 0,
      maxRetries: 3,
      startTime: now,
      pauseDuration: 0,
      lastProgressUpdate: now,
      lastLoadedBytes: 0
    };

    const timeDiff = (now - (stats.lastProgressUpdate || now)) / 1000;
    const bytesDiff = loaded - (stats.lastLoadedBytes || 0);
    
    console.log('[PROGRESS-HANDLER] Calculating transfer stats:', {
      timeDiff,
      bytesDiff,
      currentSpeed: timeDiff > 0 ? bytesDiff / timeDiff : 0
    });

    const currentSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
    const alpha = 0.2;
    const averageSpeed = stats.averageSpeed === 0 
      ? currentSpeed 
      : (alpha * currentSpeed + (1 - alpha) * stats.averageSpeed);

    const remainingBytes = total - loaded;
    const estimatedTimeRemaining = averageSpeed > 0 
      ? remainingBytes / averageSpeed 
      : 0;

    stats = {
      ...stats,
      speed: currentSpeed,
      averageSpeed,
      estimatedTimeRemaining,
      lastProgressUpdate: now,
      lastLoadedBytes: loaded
    };

    this.transferStats.set(filename, stats);
    return stats;
  }

  cleanup(filename: string) {
    console.log(`[PROGRESS-HANDLER] Cleaning up handler for ${filename}`);
    this.lastProgressUpdate.delete(filename);
    this.transferStats.delete(filename);
  }
  
  reset(filename?: string) {
    if (filename) {
      this.cleanup(filename);
    } else {
      this.lastProgressUpdate.clear();
      this.transferStats.clear();
    }
  }
}
