
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferControlHandler {
  private processingCancel: boolean = false;

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {}

  handlePause({ filename }: TransferControlMessage) {
    try {
      console.log(`[STATE] Processing pause request for ${filename}`);
      const transfer = this.store.getTransfer(filename);
      
      if (!transfer) {
        console.warn(`[STATE] Cannot pause: ${filename} does not exist in transfer store`);
        return false;
      }

      if (this.store.isPaused()) {
        console.log(`[STATE] Transfer ${filename} is already paused`);
        return true;
      }

      this.store.updateState({
        isPaused: true,
        currentTransfer: transfer
      });

      this.store.setTransfer(transfer);

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

  handleResume({ filename }: TransferControlMessage) {
    try {
      console.log(`[STATE] Processing resume request for ${filename}`);
      const transfer = this.store.getTransfer(filename);
      
      if (!transfer) {
        console.warn(`[STATE] Cannot resume: ${filename} does not exist in transfer store`);
        return false;
      }

      if (!this.store.isPaused()) {
        console.log(`[STATE] Transfer ${filename} is not paused`);
        return true;
      }

      this.store.updateState({
        isPaused: false,
        currentTransfer: transfer
      });

      this.store.setTransfer(transfer);

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

  handleCancel({ filename, isReceiver }: TransferControlMessage) {
    try {
      if (this.processingCancel) {
        console.log('[STATE] Already processing a cancel request, skipping duplicate');
        return false;
      }

      this.processingCancel = true;
      console.log(`[STATE] Processing cancel request for ${filename}`);

      const transfer = this.store.getTransfer(filename);
      if (!transfer) {
        console.warn(`[STATE] Cannot cancel: ${filename} does not exist in transfer store`);
        return false;
      }

      if (this.store.isCancelled()) {
        console.log(`[STATE] Transfer ${filename} is already cancelled`);
        return true;
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

      console.log(`[STATE] Successfully cancelled transfer for: ${filename}`);
      return true;
    } catch (error) {
      console.error('[STATE] Error handling cancel:', error);
      this.reset();
      return false;
    } finally {
      this.processingCancel = false;
    }
  }

  reset() {
    console.log('[STATE] Resetting transfer state');
    this.store.clear();
    this.progressEmitter.emit('', 'error');
    this.processingCancel = false;
  }
}
