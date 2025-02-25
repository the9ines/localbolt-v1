
import type { TransferState } from '../../types/transfer-control';
import type { TransferStats } from '../../types/transfer';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferProgressHandler {
  private lastProgressUpdate: Map<string, number> = new Map();
  private transferStats: Map<string, TransferStats> = new Map();
  private readonly UPDATE_THRESHOLD_MS = 50; // Only update progress every 50ms max
  private readonly SPEED_CALCULATION_WINDOW = 5000; // Calculate speed over 5 second window

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
      // Throttle updates to prevent excessive updates
      const now = Date.now();
      const lastUpdate = this.lastProgressUpdate.get(filename) || 0;
      
      if (now - lastUpdate < this.UPDATE_THRESHOLD_MS) {
        // Skip this update if it's too soon after the last one
        return;
      }
      
      this.lastProgressUpdate.set(filename, now);
      console.log(`[STATE] Updating progress for ${filename}: ${currentChunk}/${totalChunks} (${loaded}/${total} bytes)`);
      
      const transfer = this.store.getTransfer(filename);
      if (!transfer) {
        console.warn(`[STATE] Cannot update progress: ${filename} does not exist in transfer store`);
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
        lastUpdated: now
      };
      
      // Update transfer progress
      transfer.progress = progressUpdate;
      this.store.setTransfer(transfer);

      // Update current transfer if this is the active one
      if (this.store.getCurrentTransfer()?.filename === filename) {
        this.store.updateState({ currentTransfer: transfer });
      }

      // Emit progress update with stats
      requestAnimationFrame(() => {
        console.log('[STATE] Emitting progress update:', {
          filename,
          status: this.store.isPaused() ? 'paused' : 'transferring',
          loaded,
          total,
          currentChunk,
          totalChunks,
          stats
        });
        
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
      });

      // Check for transfer completion
      if (loaded === total && total > 0) {
        console.log(`[STATE] Transfer completed for ${filename}`);
        this.cleanup(filename);
      }
    } catch (error) {
      console.error('[STATE] Error updating transfer progress:', error);
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
      lastLoadedBytes: 0 // Initialize with 0
    };

    // Calculate current speed
    const timeDiff = (now - (stats.lastProgressUpdate || now)) / 1000; // Convert to seconds
    const bytesDiff = loaded - (stats.lastLoadedBytes || 0);
    const currentSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

    // Update moving average speed
    const alpha = 0.2; // Smoothing factor for exponential moving average
    const averageSpeed = stats.averageSpeed === 0 
      ? currentSpeed 
      : (alpha * currentSpeed + (1 - alpha) * stats.averageSpeed);

    // Calculate estimated time remaining
    const remainingBytes = total - loaded;
    const estimatedTimeRemaining = averageSpeed > 0 
      ? remainingBytes / averageSpeed 
      : 0;

    // Update stats
    stats = {
      ...stats,
      speed: currentSpeed,
      averageSpeed,
      estimatedTimeRemaining,
      lastProgressUpdate: now,
      lastLoadedBytes: loaded // Update last loaded bytes
    };

    this.transferStats.set(filename, stats);
    return stats;
  }

  cleanup(filename: string) {
    console.log(`[STATE] Cleaning up progress handler for ${filename}`);
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
