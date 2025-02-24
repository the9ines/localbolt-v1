
import type { TransferControlMessage } from '../../types/transfer-control';
import { BaseTransferHandler } from './base/BaseTransferHandler';

export class CancelHandler extends BaseTransferHandler {
  private processingCancel: boolean = false;
  private canceledTransfers: Set<string> = new Set();
  private lastCancelTime: Map<string, number> = new Map();
  private CANCEL_COOLDOWN = 1000; // 1 second cooldown between cancel messages

  handleCancel({ filename, isReceiver }: TransferControlMessage): void {
    try {
      // Immediate cleanup of progress tracking
      this.lastProgress.delete(filename);
      
      // If already cancelled, ignore additional cancel events
      if (this.canceledTransfers.has(filename)) {
        return;
      }

      const now = Date.now();
      const lastCancel = this.lastCancelTime.get(filename) || 0;
      
      if (now - lastCancel < this.CANCEL_COOLDOWN) {
        return;
      }

      if (this.processingCancel) {
        return;
      }

      this.processingCancel = true;
      this.lastCancelTime.set(filename, now);
      
      // Mark as cancelled before any other operations
      this.canceledTransfers.add(filename);
      
      // Immediately clear all state
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      // Clean up transfer state before emitting progress
      this.store.deleteTransfer(filename);
      this.activeTransfers.delete(filename);

      // Emit single cancel event
      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      this.emitProgressUpdate(filename, status);

      console.log(`[STATE] Successfully cancelled transfer for: ${filename}`);
    } catch (error) {
      console.error('[STATE] Error handling cancel:', error);
      this.reset();
    } finally {
      this.processingCancel = false;
    }
  }

  reset(): void {
    this.processingCancel = false;
    this.canceledTransfers.clear();
    this.lastCancelTime.clear();
  }
}
