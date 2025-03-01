
import type { TransferProgress } from '../../types/transfer';
import type { TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class ProgressUpdateManager {
  private lastProgressUpdate: number = 0;
  private readonly PROGRESS_UPDATE_THRESHOLD = 50; // 50ms minimum between updates

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {}

  shouldUpdateProgress(): boolean {
    const now = Date.now();
    if (now - this.lastProgressUpdate < this.PROGRESS_UPDATE_THRESHOLD) {
      return false; // Skip update if too soon
    }
    
    this.lastProgressUpdate = now;
    return true;
  }

  updateTransferProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number
  ) {
    if (this.store.isCancelled()) {
      return;
    }

    if (!this.shouldUpdateProgress()) {
      return;
    }

    const progress = {
      loaded,
      total,
      currentChunk,
      totalChunks
    };

    const transfer = this.getOrCreateTransfer(filename, total);
    transfer.progress = progress;
    this.store.setTransfer(transfer);

    // Update current transfer reference if this is the active transfer
    if (this.store.getCurrentTransfer()?.filename === filename) {
      this.store.updateState({ currentTransfer: transfer });
    }

    // Emit progress update
    this.progressEmitter.emit(
      filename,
      this.store.isPaused() ? 'paused' : 'transferring',
      progress
    );
  }

  private getOrCreateTransfer(filename: string, total: number): TransferState {
    const existing = this.store.getTransfer(filename);
    if (existing) {
      return existing;
    }

    return {
      filename,
      total,
      progress: {
        loaded: 0,
        total,
        currentChunk: 0,
        totalChunks: 0
      }
    };
  }

  reset() {
    this.lastProgressUpdate = 0;
  }
}
