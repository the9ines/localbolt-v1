
import type { TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferProgressHandler {
  private lastProgress: Map<string, TransferState['progress']> = new Map();

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
      console.log(`[STATE] Updating progress for ${filename}: ${currentChunk}/${totalChunks}`);
      
      const transfer = this.store.getTransfer(filename);
      if (!transfer) {
        console.warn(`[STATE] Cannot update progress: ${filename} does not exist in transfer store`);
        return;
      }

      // Create new progress object
      const progressUpdate = { loaded, total, currentChunk, totalChunks };
      
      // Store the last progress
      this.lastProgress.set(filename, progressUpdate);
      
      // Update transfer progress
      transfer.progress = progressUpdate;
      this.store.setTransfer(transfer);

      // Update current transfer if this is the active one
      if (this.store.getCurrentTransfer()?.filename === filename) {
        this.store.updateState({ currentTransfer: transfer });
      }

      // Use requestAnimationFrame to throttle progress updates
      requestAnimationFrame(() => {
        // Get the actual progress values from storage
        const currentTransfer = this.store.getTransfer(filename);
        const currentProgress = currentTransfer?.progress || this.lastProgress.get(filename);
        
        if (!currentProgress) {
          console.warn('[STATE] No progress data found for emit');
          return;
        }

        console.log('[STATE] Emitting progress update:', {
          filename,
          status: this.store.isPaused() ? 'paused' : 'transferring',
          progress: currentProgress,
          isPaused: this.store.isPaused()
        });
        
        // Always emit with the current state and preserved progress
        this.progressEmitter.emit(
          filename,
          this.store.isPaused() ? 'paused' : 'transferring',
          currentProgress // Use the preserved progress values
        );
      });
    } catch (error) {
      console.error('[STATE] Error updating transfer progress:', error);
    }
  }

  getLastProgress(filename: string): TransferState['progress'] | undefined {
    return this.lastProgress.get(filename);
  }
}
