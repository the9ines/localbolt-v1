
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';
import { ProgressManagerService } from './ProgressManagerService';

export class TransferPauseService {
  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter,
    private progressManager: ProgressManagerService
  ) {}

  handlePause({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing pause request for ${filename}`);
      const currentProgress = this.progressManager.getLastProgress(filename);
      
      // Always set isPaused first
      this.store.updateState({ isPaused: true });

      // Get or create transfer state using last known progress
      let transfer = this.store.getTransfer(filename);
      if (!transfer && currentProgress) {
        transfer = {
          filename,
          total: currentProgress.total,
          progress: currentProgress
        };
      } else if (!transfer) {
        const activeTransfer = this.progressManager.getActiveTransfer(filename);
        transfer = {
          filename,
          total: activeTransfer?.total || 0,
          progress: activeTransfer?.progress || null
        };
      }

      // Update stores
      this.store.setTransfer(transfer);
      this.progressManager.setActiveTransfer(filename, transfer);
      this.store.updateState({
        isPaused: true,
        currentTransfer: transfer
      });

      // Emit progress update
      if (currentProgress) {
        this.progressEmitter.emit(filename, 'paused', currentProgress);
      } else if (transfer.progress) {
        this.progressEmitter.emit(filename, 'paused', transfer.progress);
      } else {
        this.progressEmitter.emit(filename, 'paused');
      }

      return true;
    } catch (error) {
      console.error('[STATE] Error handling pause:', error);
      return false;
    }
  }

  handleResume({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing resume request for ${filename}`);
      const currentProgress = this.progressManager.getLastProgress(filename);
      
      // Always set isPaused first
      this.store.updateState({ isPaused: false });

      // Get or create transfer state using last known progress
      let transfer = this.store.getTransfer(filename);
      if (!transfer && currentProgress) {
        transfer = {
          filename,
          total: currentProgress.total,
          progress: currentProgress
        };
      } else if (!transfer) {
        const activeTransfer = this.progressManager.getActiveTransfer(filename);
        transfer = {
          filename,
          total: activeTransfer?.total || 0,
          progress: activeTransfer?.progress || null
        };
      }

      // Update stores
      this.store.setTransfer(transfer);
      this.progressManager.setActiveTransfer(filename, transfer);
      this.store.updateState({
        isPaused: false,
        currentTransfer: transfer
      });

      // Emit progress update
      if (currentProgress) {
        this.progressEmitter.emit(filename, 'transferring', currentProgress);
      } else if (transfer.progress) {
        this.progressEmitter.emit(filename, 'transferring', transfer.progress);
      } else {
        this.progressEmitter.emit(filename, 'transferring');
      }

      return true;
    } catch (error) {
      console.error('[STATE] Error handling resume:', error);
      return false;
    }
  }
}
