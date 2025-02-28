
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { BaseTransferHandler } from './base/BaseTransferHandler';

export class CancelHandler extends BaseTransferHandler {
  private processingCancel: boolean = false;
  private canceledTransfers: Set<string> = new Set();
  private lastCancelTime: Map<string, number> = new Map();
  private cancellationInProgress: Map<string, boolean> = new Map();
  private readonly CANCEL_COOLDOWN = 1000; // 1 second cooldown
  private readonly CLEANUP_DELAY = 100; // Small delay for state cleanup

  handleCancel({ filename, isReceiver }: TransferControlMessage): void {
    try {
      // Guard: Invalid filename
      if (!filename) {
        console.warn('[STATE] Attempted to cancel transfer with invalid filename');
        return;
      }

      // Guard: Already being cancelled
      if (this.cancellationInProgress.get(filename)) {
        console.log('[STATE] Cancellation already in progress for:', filename);
        return;
      }

      // Guard: Already cancelled
      if (this.canceledTransfers.has(filename)) {
        console.log('[STATE] Transfer already cancelled for:', filename);
        return;
      }

      // Guard: Cooldown period
      const now = Date.now();
      const lastCancel = this.lastCancelTime.get(filename) || 0;
      if (now - lastCancel < this.CANCEL_COOLDOWN) {
        console.log('[STATE] Cancel request within cooldown period for:', filename);
        return;
      }

      // Guard: Global cancel lock
      if (this.processingCancel) {
        console.log('[STATE] Another cancellation is being processed');
        return;
      }

      // Set cancellation flags
      this.processingCancel = true;
      this.cancellationInProgress.set(filename, true);
      this.lastCancelTime.set(filename, now);

      console.log(`[STATE] Starting cancel process for: ${filename}`);

      // 1. Immediate state updates
      this.canceledTransfers.add(filename);
      this.lastProgress.delete(filename);

      // 2. Get final state for progress update
      const finalState = this.prepareFinalState(filename);

      // 3. Clear transfer state
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      // 4. Clean up transfer data
      this.cleanupTransferData(filename);

      // 5. Emit final status
      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      // If we have final state, emit it once before clearing
      if (finalState?.progress) {
        this.emitProgressUpdate(filename, status, finalState.progress);
      }

      // Small delay before final cleanup to ensure UI has time to process
      setTimeout(() => {
        // 6. Final cleanup
        this.performFinalCleanup(filename);
        
        // 7. Emit final event without progress data
        this.emitProgressUpdate(filename, status);
        
        console.log(`[STATE] Cancel process completed for: ${filename}`);
      }, this.CLEANUP_DELAY);

    } catch (error) {
      console.error('[STATE] Error in cancel process:', error);
      // Ensure we still cleanup on error
      this.emergencyCleanup(filename);
    } finally {
      // Release global cancel lock
      this.processingCancel = false;
    }
  }

  private prepareFinalState(filename: string): TransferState | null {
    const transfer = this.store.getTransfer(filename);
    const lastProgressData = this.lastProgress.get(filename);

    // Prioritize the most recent progress data
    if (lastProgressData) {
      return {
        filename,
        total: lastProgressData.total,
        progress: lastProgressData
      };
    }

    return transfer || null;
  }

  private cleanupTransferData(filename: string): void {
    this.store.deleteTransfer(filename);
    this.activeTransfers.delete(filename);
  }

  private performFinalCleanup(filename: string): void {
    this.lastProgress.delete(filename);
    this.cancellationInProgress.delete(filename);
    console.log(`[STATE] Final cleanup completed for: ${filename}`);
  }

  private emergencyCleanup(filename: string): void {
    console.log('[STATE] Performing emergency cleanup');
    this.canceledTransfers.add(filename);
    this.lastProgress.delete(filename);
    this.store.deleteTransfer(filename);
    this.activeTransfers.delete(filename);
    this.cancellationInProgress.delete(filename);
    this.store.updateState({
      isCancelled: true,
      isPaused: false,
      currentTransfer: null
    });
  }

  reset(): void {
    this.processingCancel = false;
    this.canceledTransfers.clear();
    this.lastCancelTime.clear();
    this.cancellationInProgress.clear();
  }
}
