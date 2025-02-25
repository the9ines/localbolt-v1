
import type { TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferProgressHandler {
  private lastProgressUpdate: Map<string, number> = new Map();
  private readonly UPDATE_THRESHOLD_MS = 50; // Only update progress every 50ms max

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

      // Calculate speed if we have previous progress data
      let stats = undefined;
      
      if (transfer.progress) {
        const timeDiff = now - (transfer.progress.lastUpdated || now);
        const bytesDiff = loaded - (transfer.progress.loaded || 0);
        
        if (timeDiff > 0) {
          const currentSpeed = bytesDiff / (timeDiff / 1000);
          
          stats = {
            speed: currentSpeed,
            averageSpeed: currentSpeed, // Use current speed as average for simple implementation
            estimatedTimeRemaining: currentSpeed > 0 ? (total - loaded) / currentSpeed : 0,
            retryCount: 0,
            maxRetries: 3,
            startTime: transfer.progress.lastUpdated || now,
            pauseDuration: 0,
            lastProgressUpdate: now
          };
        }
      }

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

      // Always emit progress update with current state
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
    } catch (error) {
      console.error('[STATE] Error updating transfer progress:', error);
    }
  }
  
  reset(filename?: string) {
    if (filename) {
      this.lastProgressUpdate.delete(filename);
    } else {
      this.lastProgressUpdate.clear();
    }
  }
}
