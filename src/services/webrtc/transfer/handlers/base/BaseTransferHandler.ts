
import type { TransferState } from '../../../types/transfer-control';
import { TransferStore } from '../../TransferStore';
import { ProgressEmitter } from '../../ProgressEmitter';

export abstract class BaseTransferHandler {
  protected activeTransfers: Map<string, TransferState> = new Map();
  protected lastProgress: Map<string, TransferState['progress']> = new Map();

  constructor(
    protected store: TransferStore,
    protected progressEmitter: ProgressEmitter
  ) {}

  protected getOrCreateTransferState(filename: string): TransferState {
    const currentProgress = this.lastProgress.get(filename);
    
    let transfer = this.store.getTransfer(filename);
    if (!transfer && currentProgress) {
      transfer = {
        filename,
        total: currentProgress.total,
        progress: currentProgress
      };
    } else if (!transfer) {
      const activeTransfer = this.activeTransfers.get(filename);
      transfer = {
        filename,
        total: activeTransfer?.total || 0,
        progress: activeTransfer?.progress || null
      };
    }

    return transfer;
  }

  protected updateTransferState(transfer: TransferState): void {
    this.store.setTransfer(transfer);
    this.activeTransfers.set(transfer.filename, transfer);
  }

  protected emitProgressUpdate(filename: string, status: string, progress?: TransferState['progress']): void {
    if (progress) {
      console.log(`[STATE] Emitting ${status} with progress:`, progress);
      this.progressEmitter.emit(filename, status as any, progress);
    } else {
      console.log(`[STATE] Emitting ${status} without progress`);
      this.progressEmitter.emit(filename, status as any);
    }
  }
}
