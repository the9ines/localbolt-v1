
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';
import { ProgressManagerService } from '../services/ProgressManagerService';

export class TransferControlHandler {
  private processingCancel: boolean = false;
  private canceledTransfers: Set<string> = new Set();
  private progressManager: ProgressManagerService;

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {
    this.progressManager = new ProgressManagerService(store, progressEmitter);
  }

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

  handleCancel({ filename, isReceiver }: TransferControlMessage): void {
    try {
      if (this.processingCancel || this.canceledTransfers.has(filename)) {
        console.log('[STATE] Already processed cancel for:', filename);
        return;
      }

      this.processingCancel = true;
      console.log(`[STATE] Processing cancel request for ${filename}`);

      // Get transfer state and progress
      const transfer = this.store.getTransfer(filename) || this.progressManager.getActiveTransfer(filename);
      const currentProgress = this.progressManager.getLastProgress(filename);
      
      // Update cancelled state
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      // Emit final progress
      if (currentProgress) {
        this.progressEmitter.emit(filename, status, currentProgress);
      } else if (transfer?.progress) {
        this.progressEmitter.emit(filename, status, transfer.progress);
      } else {
        this.progressEmitter.emit(filename, status);
      }

      // Clean up transfer states
      if (transfer) {
        this.store.deleteTransfer(filename);
      }
      
      this.progressManager.removeActiveTransfer(filename);
      this.canceledTransfers.add(filename);

      console.log(`[STATE] Successfully cancelled transfer for: ${filename}`);
    } catch (error) {
      console.error('[STATE] Error handling cancel:', error);
      this.reset();
    } finally {
      this.processingCancel = false;
    }
  }

  updateTransferProgress(filename: string, progress: TransferState['progress']): void {
    if (progress) {
      this.progressManager.updateProgress(
        filename,
        progress.loaded,
        progress.total,
        progress.currentChunk,
        progress.totalChunks,
        this.store.isPaused() ? 'paused' : 'transferring'
      );
    }
  }

  markTransferActive(filename: string, total?: number): void {
    const currentProgress = this.progressManager.getLastProgress(filename);
    
    // Create or update transfer state with current progress
    const transfer = {
      filename,
      total: total || currentProgress?.total || 0,
      progress: currentProgress || null
    };
    
    this.store.setTransfer(transfer);
    this.progressManager.setActiveTransfer(filename, transfer);
  }

  reset(): void {
    console.log('[STATE] Resetting transfer state');
    this.store.clear();
    this.progressEmitter.emit('', 'error');
    this.processingCancel = false;
    this.canceledTransfers.clear();
    this.progressManager.clear();
  }
}
