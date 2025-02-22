
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

      // Get or create transfer state
      let transfer = this.store.getTransfer(filename);
      const lastProgress = this.lastProgress.get(filename);
      
      // If there's no transfer in the store but we have progress, create a transfer
      if (!transfer && lastProgress) {
        transfer = {
          filename,
          total: lastProgress.total,
          progress: lastProgress
        };
        this.store.setTransfer(transfer);
      }
      // If we still don't have a transfer, create one with default values
      else if (!transfer) {
        transfer = {
          filename,
          total: 0,
          progress: null
        };
        this.store.setTransfer(transfer);
      }

      // Update store state
      this.store.updateState({
        isPaused: true,
        currentTransfer: transfer
      });

      // Emit progress update with current progress
      const progressToUse = transfer.progress || lastProgress;
      if (progressToUse) {
        console.log('[STATE] Emitting pause with progress:', progressToUse);
        this.progressEmitter.emit(filename, 'paused', progressToUse);
      } else {
        console.log('[STATE] Emitting pause without progress');
        this.progressEmitter.emit(filename, 'paused');
      }

      console.log(`[STATE] Successfully paused transfer for: ${filename}`);
      return true;
    } catch (error) {
      console.error('[STATE] Error handling pause:', error);
      return false;
    }
  }

  handleResume({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing resume request for ${filename}`);

      // Get or create transfer state
      let transfer = this.store.getTransfer(filename);
      const lastProgress = this.lastProgress.get(filename);
      
      // If there's no transfer in the store but we have progress, create a transfer
      if (!transfer && lastProgress) {
        transfer = {
          filename,
          total: lastProgress.total,
          progress: lastProgress
        };
        this.store.setTransfer(transfer);
      }
      // If we still don't have a transfer, create one with default values
      else if (!transfer) {
        transfer = {
          filename,
          total: 0,
          progress: null
        };
        this.store.setTransfer(transfer);
      }

      // Update store state
      this.store.updateState({
        isPaused: false,
        currentTransfer: transfer
      });

      // Emit progress update with current progress
      const progressToUse = transfer.progress || lastProgress;
      if (progressToUse) {
        console.log('[STATE] Emitting resume with progress:', progressToUse);
        this.progressEmitter.emit(filename, 'transferring', progressToUse);
      } else {
        console.log('[STATE] Emitting resume without progress');
        this.progressEmitter.emit(filename, 'transferring');
      }

      console.log(`[STATE] Successfully resumed transfer for: ${filename}`);
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

      // Get transfer state from store or active transfers
      const transfer = this.store.getTransfer(filename) || this.activeTransfers.get(filename);
      const lastProgress = this.lastProgress.get(filename);
      
      // Always update cancelled state
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      // Emit progress update with most recent progress
      if (transfer?.progress) {
        this.progressEmitter.emit(filename, status, transfer.progress);
      } else if (lastProgress) {
        this.progressEmitter.emit(filename, status, lastProgress);
      } else {
        this.progressEmitter.emit(filename, status);
      }

      // Clean up transfer states
      if (transfer) {
        this.store.deleteTransfer(filename);
      }
      
      this.activeTransfers.delete(filename);
      this.lastProgress.delete(filename);
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
    // Store last known progress
    this.lastProgress.set(filename, progress);

    // Get or create transfer state
    let transfer = this.store.getTransfer(filename);
    if (!transfer) {
      transfer = {
        filename,
        total: progress.total,
        progress: progress
      };
      this.store.setTransfer(transfer);
    } else {
      transfer.progress = progress;
      this.store.setTransfer(transfer);
    }

    // Emit progress with current pause state
    const status = this.store.isPaused() ? 'paused' : 'transferring';
    this.progressEmitter.emit(filename, status, progress);
  }

  markTransferActive(filename: string, total?: number): void {
    const lastProgress = this.lastProgress.get(filename);
    
    // Create or update transfer state
    const transfer = {
      filename,
      total: total || lastProgress?.total || 0,
      progress: lastProgress || null
    };
    
    this.store.setTransfer(transfer);
  }

  reset(): void {
    console.log('[STATE] Resetting transfer state');
    this.store.clear();
    this.progressEmitter.emit('', 'error');
    this.processingCancel = false;
    this.canceledTransfers.clear();
    this.activeTransfers.clear();
    this.lastProgress.clear();
  }
}
