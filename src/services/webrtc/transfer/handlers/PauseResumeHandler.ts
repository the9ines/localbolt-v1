
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class PauseResumeHandler {
  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {}

  handlePause({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing pause request for ${filename}`);
      
      this.store.updateState({ isPaused: true });
      const transfer = this.getOrCreateTransfer(filename);

      // Update store and emit progress
      this.store.setTransfer(transfer);
      this.emitProgressUpdate(filename, 'paused', transfer);

      return true;
    } catch (error) {
      console.error('[STATE] Error handling pause:', error);
      return false;
    }
  }

  handleResume({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing resume request for ${filename}`);
      
      this.store.updateState({ isPaused: false });
      const transfer = this.getOrCreateTransfer(filename);

      // Update store and emit progress
      this.store.setTransfer(transfer);
      this.emitProgressUpdate(filename, 'transferring', transfer);

      return true;
    } catch (error) {
      console.error('[STATE] Error handling resume:', error);
      return false;
    }
  }

  private getOrCreateTransfer(filename: string): TransferState {
    let transfer = this.store.getTransfer(filename);
    if (!transfer) {
      transfer = {
        filename,
        total: 0,
        progress: null
      };
    }
    return transfer;
  }

  private emitProgressUpdate(filename: string, status: 'paused' | 'transferring', transfer: TransferState) {
    if (transfer.progress) {
      console.log(`[STATE] Emitting ${status} with transfer progress:`, transfer.progress);
      this.progressEmitter.emit(filename, status, transfer.progress);
    } else {
      console.log(`[STATE] Emitting ${status} without progress`);
      this.progressEmitter.emit(filename, status);
    }
  }
}
