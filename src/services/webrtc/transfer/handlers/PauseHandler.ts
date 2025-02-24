
import type { TransferControlMessage } from '../../types/transfer-control';
import { BaseTransferHandler } from './base/BaseTransferHandler';

export class PauseHandler extends BaseTransferHandler {
  handlePause({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing pause request for ${filename}`);
      const currentProgress = this.lastProgress.get(filename);
      
      // Always set isPaused first
      this.store.updateState({ isPaused: true });

      // Get or create transfer state
      const transfer = this.getOrCreateTransferState(filename);

      // Update store and active transfers
      this.updateTransferState(transfer);
      this.store.updateState({
        isPaused: true,
        currentTransfer: transfer
      });

      // Emit progress update
      if (currentProgress) {
        this.emitProgressUpdate(filename, 'paused', currentProgress);
      } else if (transfer.progress) {
        this.emitProgressUpdate(filename, 'paused', transfer.progress);
      } else {
        this.emitProgressUpdate(filename, 'paused');
      }

      return true;
    } catch (error) {
      console.error('[STATE] Error handling pause:', error);
      return false;
    }
  }
}
