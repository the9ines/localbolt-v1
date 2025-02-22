
import type { TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class ProgressManagerService {
  private lastProgress: Map<string, TransferState['progress']> = new Map();
  private activeTransfers: Map<string, TransferState> = new Map();

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {}

  updateProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number,
    status: 'transferring' | 'paused' = 'transferring'
  ) {
    try {
      console.log(`[STATE] Updating progress for ${filename}: ${currentChunk}/${totalChunks}`);
      
      // Create new progress object
      const progressUpdate = { loaded, total, currentChunk, totalChunks };
      this.lastProgress.set(filename, progressUpdate);

      // Get or create transfer state
      let transfer = this.store.getTransfer(filename);
      if (!transfer) {
        transfer = {
          filename,
          total,
          progress: progressUpdate
        };
      } else {
        transfer.progress = progressUpdate;
      }

      // Update stores
      this.store.setTransfer(transfer);
      this.activeTransfers.set(filename, transfer);

      if (this.store.getCurrentTransfer()?.filename === filename) {
        this.store.updateState({ currentTransfer: transfer });
      }

      // Emit progress update
      requestAnimationFrame(() => {
        console.log('[STATE] Emitting progress update:', {
          filename,
          status,
          progress: progressUpdate
        });
        
        this.progressEmitter.emit(filename, status, progressUpdate);
      });
    } catch (error) {
      console.error('[STATE] Error updating progress:', error);
    }
  }

  getLastProgress(filename: string): TransferState['progress'] | undefined {
    return this.lastProgress.get(filename);
  }

  getActiveTransfer(filename: string): TransferState | undefined {
    return this.activeTransfers.get(filename);
  }

  setActiveTransfer(filename: string, transfer: TransferState) {
    this.activeTransfers.set(filename, transfer);
  }

  removeActiveTransfer(filename: string) {
    this.activeTransfers.delete(filename);
    this.lastProgress.delete(filename);
  }

  clear() {
    this.activeTransfers.clear();
    this.lastProgress.clear();
  }
}
