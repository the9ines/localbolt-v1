
import type { TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferProgressHandler {
  private lastProgress: Map<string, TransferState['progress']> = new Map();
  private progressUpdateTimeout: number | null = null;

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {
    console.log('[PROGRESS] TransferProgressHandler initialized');
  }

  updateProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number
  ) {
    try {
      // Log detailed progress information
      console.log('[PROGRESS] Begin progress update:', {
        filename,
        loaded,
        total,
        currentChunk,
        totalChunks,
        percentage: ((loaded / total) * 100).toFixed(2) + '%'
      });
      
      // Log current store state
      console.log('[PROGRESS] Current store state:', {
        isPaused: this.store.isPaused(),
        currentTransfer: this.store.getCurrentTransfer(),
        existingTransfer: this.store.getTransfer(filename)
      });
      
      // Get or create transfer object
      const transfer = this.store.getTransfer(filename) || {
        filename,
        total,
        progress: null
      };

      // Create new progress object
      const progressUpdate = { loaded, total, currentChunk, totalChunks };
      
      console.log('[PROGRESS] Created progress update:', progressUpdate);
      
      // Store the last progress
      this.lastProgress.set(filename, progressUpdate);
      
      // Update transfer progress
      transfer.progress = progressUpdate;
      this.store.setTransfer(transfer);

      // Update current transfer if this is the active one
      if (this.store.getCurrentTransfer()?.filename === filename) {
        console.log('[PROGRESS] Updating current transfer state');
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

        const emitData = {
          filename,
          status,
          progress: progressUpdate,
          isPaused,
          currentChunk,
          totalChunks,
          timestamp: new Date().toISOString()
        };
        
        console.log('[PROGRESS] Emitting progress update:', emitData);
        
        this.progressEmitter.emit(
          filename,
          status,
          progressUpdate
        );

        // Log after emission
        console.log('[PROGRESS] Progress update emitted successfully');
      }, 16); // ~60fps throttle

    } catch (error) {
      console.error('[PROGRESS] Error updating transfer progress:', {
        error,
        filename,
        loaded,
        total,
        currentChunk,
        totalChunks
      });
      // Re-throw to ensure error is propagated
      throw error;
    }
  }

  getLastProgress(filename: string): TransferState['progress'] | undefined {
    const progress = this.lastProgress.get(filename);
    console.log('[PROGRESS] Retrieved last progress for:', filename, progress);
    return progress;
  }
}
