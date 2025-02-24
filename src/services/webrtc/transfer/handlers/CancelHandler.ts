
import type { TransferControlMessage } from '../../types/transfer-control';
import { BaseTransferHandler } from './base/BaseTransferHandler';

export class CancelHandler extends BaseTransferHandler {
  private processingCancel: boolean = false;
  private canceledTransfers: Set<string> = new Set();
  private lastCancelTime: Map<string, number> = new Map();
  private CANCEL_COOLDOWN = 1000; // 1 second cooldown between cancel messages

  handleCancel({ filename, isReceiver }: TransferControlMessage): void {
    try {
      // If we're already processing a cancel for this file, ignore
      if (this.canceledTransfers.has(filename)) {
        console.log('[STATE] Already cancelled transfer for:', filename);
        return;
      }

      const now = Date.now();
      const lastCancel = this.lastCancelTime.get(filename) || 0;
      
      // Prevent duplicate cancel processing within cooldown period
      if (now - lastCancel < this.CANCEL_COOLDOWN) {
        console.log('[STATE] Ignoring duplicate cancel within cooldown for:', filename);
        return;
      }

      if (this.processingCancel) {
        console.log('[STATE] Already processing a cancel request');
        return;
      }

      this.processingCancel = true;
      this.lastCancelTime.set(filename, now);
      console.log(`[STATE] Processing cancel request for ${filename}`);

      // Get transfer state
      const transfer = this.store.getTransfer(filename);
      const currentProgress = this.lastProgress.get(filename);
      
      // Mark as cancelled immediately
      this.canceledTransfers.add(filename);
      
      // Update cancelled state
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      // Only emit one progress update for this cancel
      if (currentProgress) {
        this.emitProgressUpdate(filename, status, currentProgress);
      } else if (transfer?.progress) {
        this.emitProgressUpdate(filename, status, transfer.progress);
      } else {
        this.emitProgressUpdate(filename, status);
      }

      // Clean up transfer states immediately
      this.store.deleteTransfer(filename);
      this.activeTransfers.delete(filename);
      this.lastProgress.delete(filename);

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
