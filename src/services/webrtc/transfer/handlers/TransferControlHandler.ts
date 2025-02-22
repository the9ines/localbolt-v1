
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferControlHandler {
  private processingCancel: boolean = false;
  private canceledTransfers: Set<string> = new Set();
  private activeTransfers: Map<string, TransferState> = new Map();

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {}

  handlePause({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing pause request for ${filename}`);

      // Check current pause state
      if (this.store.isPaused()) {
        console.log(`[STATE] Transfer ${filename} is already paused`);
        return true;
      }

      // Get existing transfer or create new one
      let transfer = this.store.getTransfer(filename);
      
      if (!transfer) {
        // Get from active transfers if exists
        transfer = this.activeTransfers.get(filename);
      }
      
      if (!transfer) {
        // Create new transfer state if none exists
        transfer = {
          filename,
          total: 0,
          progress: null
        };
        
        this.activeTransfers.set(filename, transfer);
      }

      // Update store with transfer state
      this.store.setTransfer(transfer);
      this.store.updateState({
        isPaused: true,
        currentTransfer: transfer
      });

      // Emit progress update
      if (transfer.progress) {
        console.log('[STATE] Updating progress with paused status');
        this.progressEmitter.emit(filename, 'paused', transfer.progress);
      } else {
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

      if (!this.store.isPaused()) {
        console.log(`[STATE] Transfer ${filename} is not paused`);
        return true;
      }

      // Get existing transfer or create new one
      let transfer = this.store.getTransfer(filename);
      
      if (!transfer) {
        // Get from active transfers if exists
        transfer = this.activeTransfers.get(filename);
      }
      
      if (!transfer) {
        // Create new transfer state if none exists
        transfer = {
          filename,
          total: 0,
          progress: null
        };
        
        this.activeTransfers.set(filename, transfer);
      }

      // Update store with transfer state
      this.store.setTransfer(transfer);
      this.store.updateState({
        isPaused: false,
        currentTransfer: transfer
      });

      // Emit progress update
      if (transfer.progress) {
        console.log('[STATE] Updating progress with transferring status');
        this.progressEmitter.emit(filename, 'transferring', transfer.progress);
      } else {
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
      
      // Always update cancelled state
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      // Emit progress update
      if (transfer?.progress) {
        this.progressEmitter.emit(filename, status, transfer.progress);
      } else {
        this.progressEmitter.emit(filename, status);
      }

      // Clean up transfer states
      if (transfer) {
        this.store.deleteTransfer(filename);
      }
      
      this.activeTransfers.delete(filename);
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
    // Update progress in both store and active transfers
    const transfer = this.store.getTransfer(filename) || this.activeTransfers.get(filename);
    if (transfer) {
      transfer.progress = progress;
      this.store.setTransfer(transfer);
      this.activeTransfers.set(filename, transfer);
    }
  }

  markTransferActive(filename: string, total?: number): void {
    // Create or update transfer state
    const transfer = this.store.getTransfer(filename) || this.activeTransfers.get(filename) || {
      filename,
      total: total || 0,
      progress: null
    };
    
    if (total !== undefined) {
      transfer.total = total;
    }
    
    this.activeTransfers.set(filename, transfer);
    this.store.setTransfer(transfer);
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
