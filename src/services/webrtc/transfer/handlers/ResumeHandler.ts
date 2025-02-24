
import type { TransferControlMessage } from '../../types/transfer-control';
import { BaseTransferHandler } from './base/BaseTransferHandler';

export class ResumeHandler extends BaseTransferHandler {
  handleResume({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing resume request for ${filename}`);
      const currentProgress = this.lastProgress.get(filename);
      
      // Always set isPaused first
      this.store.updateState({ isPaused: false });

      // Get or create transfer state
      const transfer = this.getOrCreateTransferState(filename);

      // Update store and active transfers
      this.updateTransferState(transfer);
      this.store.updateState({
        isPaused: false,
        currentTransfer: transfer
      });

      // Emit progress update
      if (currentProgress) {
        this.emitProgressUpdate(filename, 'transferring', currentProgress);
      } else if (transfer.progress) {
        this.emitProgressUpdate(filename, 'transferring', transfer.progress);
      } else {
        this.emitProgressUpdate(filename, 'transferring');
      }

      return true;
    } catch (error) {
      console.error('[STATE] Error handling resume:', error);
      return false;
    }
  }
}
