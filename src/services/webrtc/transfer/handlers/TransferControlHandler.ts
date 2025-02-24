
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
      } else if (!transfer) {
        const activeTransfer = this.activeTransfers.get(filename);
        transfer = {
          filename,
          total: activeTransfer?.total || 0,
          progress: activeTransfer?.progress || null
        };
      }

      // Update store and active transfers
      this.store.setTransfer(transfer);
      this.activeTransfers.set(filename, transfer);
      this.store.updateState({
        isPaused: true,
        currentTransfer: transfer
      });

      // Always emit progress update with most recent progress
      if (currentProgress) {
        console.log('[STATE] Emitting pause with progress:', currentProgress);
        this.progressEmitter.emit(filename, 'paused', currentProgress);
      } else if (transfer.progress) {
        console.log('[STATE] Emitting pause with transfer progress:', transfer.progress);
        this.progressEmitter.emit(filename, 'paused', transfer.progress);
      } else {
        console.log('[STATE] Emitting pause without progress');
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
      } else if (!transfer) {
        const activeTransfer = this.activeTransfers.get(filename);
        transfer = {
          filename,
          total: activeTransfer?.total || 0,
          progress: activeTransfer?.progress || null
        };
      }

      // Update store and active transfers
      this.store.setTransfer(transfer);
      this.activeTransfers.set(filename, transfer);
      this.store.updateState({
        isPaused: false,
        currentTransfer: transfer
      });

      // Always emit progress update with most recent progress
      if (currentProgress) {
        console.log('[STATE] Emitting resume with progress:', currentProgress);
        this.progressEmitter.emit(filename, 'transferring', currentProgress);
      } else if (transfer.progress) {
        console.log('[STATE] Emitting resume with transfer progress:', transfer.progress);
        this.progressEmitter.emit(filename, 'transferring', transfer.progress);
      } else {
        console.log('[STATE] Emitting resume without progress');
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

      // Get transfer state from store or active transfers
      const transfer = this.store.getTransfer(filename) || this.activeTransfers.get(filename);
      const currentProgress = this.lastProgress.get(filename);
      
      // Always update cancelled state
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      // Emit progress update with most recent progress
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
    console.log('[STATE] Updating transfer progress:', { filename, progress });
    
    // Always store the last progress
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

  markTransferActive(filename: string, total?: number): void {
    const currentProgress = this.lastProgress.get(filename);
    
    // Create or update transfer state with current progress
    const transfer = {
      filename,
      total: total || currentProgress?.total || 0,
      progress: currentProgress || null
    };
    
    this.store.setTransfer(transfer);
    this.activeTransfers.set(filename, transfer);
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
