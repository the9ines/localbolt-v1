
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferControlHandler {
  private processingCancel: boolean = false;
  private canceledTransfers: Set<string> = new Set();
  private activeTransfers: Set<string> = new Set();

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {}

  handlePause({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing pause request for ${filename}`);

      // First check if we're tracking this transfer as active
      if (!this.activeTransfers.has(filename)) {
        this.activeTransfers.add(filename);
      }

      // Check current pause state
      if (this.store.isPaused()) {
        console.log(`[STATE] Transfer ${filename} is already paused`);
        return true;
      }

      const transfer = this.store.getTransfer(filename);
      if (!transfer) {
        // Create a new transfer state if none exists
        const newTransfer: TransferState = {
          filename,
          total: 0, // Will be updated when data arrives
          progress: null
        };
        
        this.store.setTransfer(newTransfer);
        this.store.updateState({
          isPaused: true,
          currentTransfer: newTransfer
        });
        
        this.progressEmitter.emit(filename, 'paused');
        console.log(`[STATE] Created and paused new transfer state for ${filename}`);
        return true;
      }

      this.store.updateState({
        isPaused: true,
        currentTransfer: transfer
      });

      if (transfer.progress) {
        console.log('[STATE] Updating progress with paused status');
        this.progressEmitter.emit(filename, 'paused', transfer.progress);
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

      if (!this.store.isPaused()) {
        console.log(`[STATE] Transfer ${filename} is not paused`);
        return true;
      }

      const transfer = this.store.getTransfer(filename);
      if (!transfer && this.activeTransfers.has(filename)) {
        // Create a new transfer state if none exists but we know it's active
        const newTransfer: TransferState = {
          filename,
          total: 0,
          progress: null
        };
        
        this.store.setTransfer(newTransfer);
        this.store.updateState({
          isPaused: false,
          currentTransfer: newTransfer
        });
        
        this.progressEmitter.emit(filename, 'transferring');
        console.log(`[STATE] Created and resumed new transfer state for ${filename}`);
        return true;
      }

      if (!transfer) {
        console.log(`[STATE] Cannot resume: ${filename} is not an active transfer`);
        return false;
      }

      this.store.updateState({
        isPaused: false,
        currentTransfer: transfer
      });

      if (transfer.progress) {
        console.log('[STATE] Updating progress with transferring status');
        this.progressEmitter.emit(filename, 'transferring', transfer.progress);
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

      const transfer = this.store.getTransfer(filename);
      const wasActive = this.activeTransfers.has(filename);

      // Always update cancelled state
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      if (transfer?.progress) {
        this.progressEmitter.emit(filename, status, transfer.progress);
      } else if (wasActive) {
        // If it was active but no transfer object exists, still emit the status
        this.progressEmitter.emit(filename, status);
      }

      if (transfer) {
        this.store.deleteTransfer(filename);
      }

      this.canceledTransfers.add(filename);
      this.activeTransfers.delete(filename);
      console.log(`[STATE] Successfully cancelled transfer for: ${filename}`);

    } catch (error) {
      console.error('[STATE] Error handling cancel:', error);
      this.reset();
    } finally {
      this.processingCancel = false;
    }
  }

  markTransferActive(filename: string): void {
    this.activeTransfers.add(filename);
  }

  reset(): void {
    console.log('[STATE] Resetting transfer state');
    this.store.clear();
    this.progressEmitter.emit('', 'error');
    this.processingCancel = false;
    this.canceledTransfers.clear();
    this.activeTransfers.clear();
  }
}
