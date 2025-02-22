
import type { TransferControlMessage } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';
import { ProgressManagerService } from './ProgressManagerService';

export class TransferCancelService {
  private processingCancel: boolean = false;
  private canceledTransfers: Set<string> = new Set();

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter,
    private progressManager: ProgressManagerService
  ) {}

  handleCancel({ filename, isReceiver }: TransferControlMessage): void {
    try {
      if (this.processingCancel || this.canceledTransfers.has(filename)) {
        console.log('[STATE] Already processed cancel for:', filename);
        return;
      }

      this.processingCancel = true;
      console.log(`[STATE] Processing cancel request for ${filename}`);

      // Get transfer state and progress
      const transfer = this.store.getTransfer(filename) || this.progressManager.getActiveTransfer(filename);
      const currentProgress = this.progressManager.getLastProgress(filename);
      
      // Update cancelled state
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      // Emit final progress
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
      
      this.progressManager.removeActiveTransfer(filename);
      this.canceledTransfers.add(filename);

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
  }
}
