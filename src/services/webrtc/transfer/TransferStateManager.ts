
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
      const transfer = this.store.getTransfer(filename);

      if (!transfer) {
        console.warn(`[STATE] Cannot pause: ${filename} is not active`);
        return;
      }

      console.log(`[STATE] Setting transfer to paused state for: ${filename}`);
      this.store.updateState({
        isPaused: true,
        currentTransfer: transfer
      });

      if (transfer.progress) {
        console.log('[STATE] Updating progress with paused status');
        this.progressEmitter.emit(filename, 'paused', transfer.progress);
      }
    } catch (error) {
      console.error('[STATE] Error handling pause:', error);
    }
  }

  handleResume({ filename }: TransferControlMessage) {
    try {
      console.log(`[STATE] Processing resume request for ${filename}`);
      const transfer = this.store.getTransfer(filename);

      if (!transfer) {
        console.warn(`[STATE] Cannot resume: ${filename} is not active`);
        return;
      }

      console.log(`[STATE] Setting transfer to resumed state for: ${filename}`);
      this.store.updateState({
        isPaused: false,
        currentTransfer: transfer
      });

      if (transfer.progress) {
        console.log('[STATE] Updating progress with transferring status');
        this.progressEmitter.emit(filename, 'transferring', transfer.progress);
      }
    } catch (error) {
      console.error('[STATE] Error handling resume:', error);
    }
  }

  handleCancel({ filename, isReceiver }: TransferControlMessage) {
    try {
      console.log(`[STATE] Processing cancel request for ${filename}`);
      const transfer = this.store.getTransfer(filename);

      if (!transfer) {
        console.warn(`[STATE] Cannot cancel: ${filename} is not active`);
        return;
      }

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      console.log(`[STATE] Setting transfer to ${status} state for: ${filename}`);

      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });
      
      this.store.deleteTransfer(filename);
      this.progressEmitter.emit(filename, status, transfer.progress);

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
        console.warn(`[STATE] Cannot update progress: ${filename} is not active`);
        return;
      }

      transfer.progress = {
        loaded,
        total,
        currentChunk,
        totalChunks
      };

      this.store.setTransfer(transfer);

      // Update current transfer if it matches
      if (this.store.getCurrentTransfer()?.filename === filename) {
        this.store.updateState({ currentTransfer: transfer });
      }

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
