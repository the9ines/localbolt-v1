
import type { TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferProgressHandler {
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

      transfer.progress = { loaded, total, currentChunk, totalChunks };
      this.store.setTransfer(transfer);

      if (this.store.getCurrentTransfer()?.filename === filename) {
        this.store.updateState({ currentTransfer: transfer });
      }

      requestAnimationFrame(() => {
        if (transfer.progress) {
          console.log('[STATE] Emitting progress update');
          this.progressEmitter.emit(
            filename,
            this.store.isPaused() ? 'paused' : 'transferring',
            transfer.progress
          );
        }
      });
    } catch (error) {
      console.error('[STATE] Error updating transfer progress:', error);
    }
  }
}
