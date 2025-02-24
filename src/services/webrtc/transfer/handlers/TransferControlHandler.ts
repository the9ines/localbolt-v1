
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferControlHandler {
  private processingCancel: boolean = false;
  private canceledTransfers: Set<string> = new Set();
  private activeTransfers: Map<string, TransferState> = new Map();
  private lastProgress: Map<string, TransferState['progress']> = new Map();

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {}

  handlePause({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing pause request for ${filename}`);
      const currentProgress = this.lastProgress.get(filename);
      
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
      }

      // Update store and active transfers
      if (transfer) {
        this.store.setTransfer(transfer);
        this.activeTransfers.set(filename, transfer);
        this.store.updateState({
          isPaused: true,
          currentTransfer: transfer
        });
      }

      // Emit progress update with most recent progress
      if (currentProgress) {
        this.progressEmitter.emit(filename, 'paused', currentProgress);
      } else if (transfer?.progress) {
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
      const currentProgress = this.lastProgress.get(filename);
      
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
      }

      // Update store and active transfers
      if (transfer) {
        this.store.setTransfer(transfer);
        this.activeTransfers.set(filename, transfer);
        this.store.updateState({
          isPaused: false,
          currentTransfer: transfer
        });
      }

      // Emit progress update with most recent progress
      if (currentProgress) {
        this.progressEmitter.emit(filename, 'transferring', currentProgress);
      } else if (transfer?.progress) {
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
    if (this.processingCancel) {
      console.log('[STATE] Cancel already in progress, skipping duplicate cancel');
      return;
    }

    if (this.canceledTransfers.has(filename)) {
      console.log('[STATE] Transfer already cancelled:', filename);
      return;
    }

    try {
      this.processingCancel = true;
      console.log(`[STATE] Processing cancel request for ${filename}`);

      // Get current state before clearing
      const transfer = this.store.getTransfer(filename);
      const currentProgress = this.lastProgress.get(filename);
      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';

      // Update store state immediately
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      // Clean up transfer states
      this.store.deleteTransfer(filename);
      this.activeTransfers.delete(filename);
      this.lastProgress.delete(filename);
      this.canceledTransfers.add(filename);

      // Emit final progress update
      if (currentProgress) {
        this.progressEmitter.emit(filename, status, currentProgress);
      } else if (transfer?.progress) {
        this.progressEmitter.emit(filename, status, transfer.progress);
      } else {
        this.progressEmitter.emit(filename, status);
      }

      console.log(`[STATE] Successfully cancelled transfer for: ${filename}`);
    } catch (error) {
      console.error('[STATE] Error handling cancel:', error);
      this.reset();
    } finally {
      // Clear processing flag after a short delay to prevent rapid re-cancellation
      setTimeout(() => {
        this.processingCancel = false;
      }, 100);
    }
  }

  updateTransferProgress(filename: string, progress: TransferState['progress']): void {
    if (this.canceledTransfers.has(filename)) {
      console.log('[STATE] Ignoring progress update for cancelled transfer:', filename);
      return;
    }

    // Store the last progress
    this.lastProgress.set(filename, progress);

    // Get or create transfer state
    let transfer = this.store.getTransfer(filename);
    if (!transfer) {
      transfer = {
        filename,
        total: progress.total,
        progress: progress
      };
    } else {
      transfer.progress = progress;
    }

    // Update both store and active transfers
    this.store.setTransfer(transfer);
    this.activeTransfers.set(filename, transfer);

    // Emit progress with current pause state
    const status = this.store.isPaused() ? 'paused' : 'transferring';
    this.progressEmitter.emit(filename, status, progress);
  }

  reset(): void {
    console.log('[STATE] Resetting transfer control handler');
    this.processingCancel = false;
    this.canceledTransfers.clear();
    this.activeTransfers.clear();
    this.lastProgress.clear();
  }
}
