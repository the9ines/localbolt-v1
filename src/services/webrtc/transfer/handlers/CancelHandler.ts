
import type { TransferControlMessage } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class CancelHandler {
  private processingCancel: boolean = false;
  private canceledTransfers: Set<string> = new Set();

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter,
    private getLastProgress: (filename: string) => any
  ) {}

  handleCancel({ filename, isReceiver }: TransferControlMessage): void {
    try {
      if (this.processingCancel || this.canceledTransfers.has(filename)) {
        console.log('[STATE] Already processed cancel for:', filename);
        return;
      }

      this.processingCancel = true;
      console.log(`[STATE] Processing cancel request for ${filename}`);

      const transfer = this.store.getTransfer(filename);
      const currentProgress = this.getLastProgress(filename);
      
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      if (currentProgress) {
        this.progressEmitter.emit(filename, status, currentProgress);
      } else if (transfer?.progress) {
        this.progressEmitter.emit(filename, status, transfer.progress);
      } else {
        this.progressEmitter.emit(filename, status);
      }

      if (transfer) {
        this.store.deleteTransfer(filename);
      }
      
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
