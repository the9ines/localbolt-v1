
import type { TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferProgressHandler {
  private lastProgress: Map<string, TransferState['progress']> = new Map();
  private progressUpdateTimeout: number | null = null;

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
      console.log(`[STATE] Updating progress for ${filename}: ${currentChunk}/${totalChunks}, loaded: ${loaded}/${total}`);
      
      // Get or create transfer object
      const transfer = this.store.getTransfer(filename) || {
        filename,
        total,
        progress: null
      };

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

      // Clear any existing timeout
      if (this.progressUpdateTimeout) {
        window.clearTimeout(this.progressUpdateTimeout);
      }

      // Throttle progress updates to prevent UI flooding
      this.progressUpdateTimeout = window.setTimeout(() => {
        const isPaused = this.store.isPaused();
        const status = isPaused ? 'paused' : 'transferring';

        console.log('[STATE] Emitting progress update:', {
          filename,
          status,
          progress: progressUpdate,
          isPaused,
          currentChunk,
          totalChunks
        });
        
        this.progressEmitter.emit(
          filename,
          status,
          progressUpdate
        );
      }, 16); // ~60fps throttle

    } catch (error) {
      console.error('[STATE] Error updating transfer progress:', error);
    }
  }

  getLastProgress(filename: string): TransferState['progress'] | undefined {
    return this.lastProgress.get(filename);
  }
}
