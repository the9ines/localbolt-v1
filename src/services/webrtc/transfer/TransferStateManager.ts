
import type { TransferProgress } from '../types/transfer';
import type { TransferControlMessage, TransferState } from '../types/transfer-control';
import { TransferStore } from './TransferStore';
import { ProgressEmitter } from './ProgressEmitter';

export class TransferStateManager {
  private store: TransferStore;
  private progressEmitter: ProgressEmitter;

  constructor(onProgress?: (progress: TransferProgress) => void) {
    this.store = new TransferStore();
    this.progressEmitter = new ProgressEmitter(onProgress);
  }

  getCurrentTransfer() {
    return this.store.getCurrentTransfer();
  }

  isPaused() {
    return this.store.isPaused();
  }

  isCancelled() {
    return this.store.isCancelled();
  }

  isTransferActive(filename: string): boolean {
    return this.store.isTransferActive(filename);
  }

  startTransfer(filename: string, total: number) {
    try {
      console.log(`[STATE] Starting new transfer for ${filename}`);
      const newTransfer: TransferState = {
        filename,
        total,
        progress: {
          loaded: 0,
          total,
          currentChunk: 0,
          totalChunks: 0
        }
      };

      // Update both the transfer list and current state atomically
      this.store.setTransfer(newTransfer);
      this.store.updateState({
        isPaused: false,
        isCancelled: false,
        currentTransfer: newTransfer
      });
      
      console.log('[STATE] Transfer started, initial state:', newTransfer);
      this.progressEmitter.emit(filename, 'transferring');
    } catch (error) {
      console.error('[STATE] Error starting transfer:', error);
      this.reset();
    }
  }

  handlePause({ filename }: TransferControlMessage) {
    try {
      console.log(`[STATE] Processing pause request for ${filename}`);

      // First check if we have this transfer in our store
      const transfer = this.store.getTransfer(filename);
      if (!transfer) {
        console.warn(`[STATE] Cannot pause: ${filename} does not exist in transfer store`);
        return;
      }

      // Update the state before checking if transfer is active
      this.store.updateState({
        isPaused: true,
        currentTransfer: transfer
      });

      // Set the transfer again to ensure it's marked as active
      this.store.setTransfer(transfer);

      if (transfer.progress) {
        console.log('[STATE] Updating progress with paused status');
        this.progressEmitter.emit(filename, 'paused', transfer.progress);
      }

      console.log(`[STATE] Successfully paused transfer for: ${filename}`);
    } catch (error) {
      console.error('[STATE] Error handling pause:', error);
    }
  }

  handleResume({ filename }: TransferControlMessage) {
    try {
      console.log(`[STATE] Processing resume request for ${filename}`);
      
      // First check if we have this transfer in our store
      const transfer = this.store.getTransfer(filename);
      if (!transfer) {
        console.warn(`[STATE] Cannot resume: ${filename} does not exist in transfer store`);
        return;
      }

      // Update the state before checking if transfer is active
      this.store.updateState({
        isPaused: false,
        currentTransfer: transfer
      });

      // Set the transfer again to ensure it's marked as active
      this.store.setTransfer(transfer);

      if (transfer.progress) {
        console.log('[STATE] Updating progress with transferring status');
        this.progressEmitter.emit(filename, 'transferring', transfer.progress);
      }

      console.log(`[STATE] Successfully resumed transfer for: ${filename}`);
    } catch (error) {
      console.error('[STATE] Error handling resume:', error);
    }
  }

  handleCancel({ filename, isReceiver }: TransferControlMessage) {
    try {
      console.log(`[STATE] Processing cancel request for ${filename}`);
      
      const transfer = this.store.getTransfer(filename);
      if (!transfer) {
        console.warn(`[STATE] Cannot cancel: ${filename} does not exist in transfer store`);
        return;
      }

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      console.log(`[STATE] Setting transfer to ${status} state for: ${filename}`);

      // Update state before removing the transfer
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      // Send progress update before removing the transfer
      this.progressEmitter.emit(filename, status, transfer.progress);
      
      // Remove the transfer last
      this.store.deleteTransfer(filename);

      // Send a final progress update after a short delay
      setTimeout(() => {
        this.progressEmitter.emit(filename, status);
      }, 100);
    } catch (error) {
      console.error('[STATE] Error handling cancel:', error);
      this.reset();
    }
  }

  updateTransferProgress(
    filename: string, 
    loaded: number, 
    total: number, 
    currentChunk: number, 
    totalChunks: number
  ) {
    try {
      console.log(`[STATE] Updating progress for ${filename}: ${currentChunk}/${totalChunks}`);
      
      const transfer = this.store.getTransfer(filename);
      if (!transfer) {
        console.warn(`[STATE] Cannot update progress: ${filename} does not exist in transfer store`);
        return;
      }

      // Update progress information
      transfer.progress = {
        loaded,
        total,
        currentChunk,
        totalChunks
      };

      // Update the transfer in store
      this.store.setTransfer(transfer);

      // Update current transfer if it matches
      if (this.store.getCurrentTransfer()?.filename === filename) {
        this.store.updateState({ currentTransfer: transfer });
      }

      // Emit progress update on next animation frame
      requestAnimationFrame(() => {
        if (transfer.progress) {
          console.log('[STATE] Emitting progress update');
          this.progressEmitter.emit(
            filename,
            this.store.isPaused() ? 'paused' : 'transferring',
            transfer.progress
          );
        }
      });
    } catch (error) {
      console.error('[STATE] Error updating transfer progress:', error);
    }
  }

  reset() {
    console.log('[STATE] Resetting transfer state');
    this.store.clear();
    this.progressEmitter.emit('', 'error');
  }
}
