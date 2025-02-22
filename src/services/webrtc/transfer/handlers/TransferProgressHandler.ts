
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

      // Emit progress update immediately
      const isPaused = this.store.isPaused();
      const status = isPaused ? 'paused' : 'transferring';

      this.progressEmitter.emit(
        filename,
        status,
        progressUpdate
      );

    } catch (error) {
      console.error('[PROGRESS] Error updating transfer progress:', error);
      throw error;
    }
  }

  getLastProgress(filename: string): TransferState['progress'] | undefined {
    return this.lastProgress.get(filename);
  }
}
