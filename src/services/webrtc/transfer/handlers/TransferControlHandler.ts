
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';
import { createTransferProgress } from '../utils/transfer-utils';

export class TransferControlHandler {
  private processingCancel: boolean = false;
  private canceledTransfers: Set<string> = new Set();
  private activeTransfers: Map<string, TransferState> = new Map();
  private lastProgress: Map<string, TransferState['progress']> = new Map();

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {}

  private updateTransferState(
    filename: string, 
    status: 'transferring' | 'paused' | 'canceled_by_sender' | 'canceled_by_receiver',
    progress?: TransferState['progress']
  ) {
    const transfer = this.store.getTransfer(filename) || {
      filename,
      total: progress?.total || 0,
      progress
    };

    this.store.setTransfer(transfer);
    this.activeTransfers.set(filename, transfer);
    
    if (progress) {
      this.progressEmitter.emit(filename, status, progress);
    }
  }

  handlePause({ filename }: TransferControlMessage): boolean {
    try {
      const currentProgress = this.lastProgress.get(filename);
      this.store.updateState({ isPaused: true });
      
      if (currentProgress || this.activeTransfers.has(filename)) {
        this.updateTransferState(filename, 'paused', currentProgress);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[STATE] Error handling pause:', error);
      return false;
    }
  }

  handleResume({ filename }: TransferControlMessage): boolean {
    try {
      const currentProgress = this.lastProgress.get(filename);
      this.store.updateState({ isPaused: false });
      
      if (currentProgress || this.activeTransfers.has(filename)) {
        this.updateTransferState(filename, 'transferring', currentProgress);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[STATE] Error handling resume:', error);
      return false;
    }
  }

  handleCancel({ filename, isReceiver }: TransferControlMessage): void {
    if (this.processingCancel || this.canceledTransfers.has(filename)) {
      return;
    }

    try {
      this.processingCancel = true;
      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      this.store.updateState({
        isCancelled: true,
        isPaused: false,
        currentTransfer: null
      });

      const currentProgress = this.lastProgress.get(filename);
      this.updateTransferState(filename, status, currentProgress);
      
      this.store.deleteTransfer(filename);
      this.activeTransfers.delete(filename);
      this.lastProgress.delete(filename);
      this.canceledTransfers.add(filename);
    } finally {
      this.processingCancel = false;
    }
  }

  updateTransferProgress(filename: string, progress: TransferState['progress']): void {
    this.lastProgress.set(filename, progress);
    const status = this.store.isPaused() ? 'paused' : 'transferring';
    this.updateTransferState(filename, status, progress);
  }

  markTransferActive(filename: string, total?: number): void {
    const currentProgress = this.lastProgress.get(filename);
    const transfer = {
      filename,
      total: total || currentProgress?.total || 0,
      progress: currentProgress || null
    };
    this.store.setTransfer(transfer);
    this.activeTransfers.set(filename, transfer);
  }

  reset(): void {
    this.store.clear();
    this.progressEmitter.emit('', 'error');
    this.processingCancel = false;
    this.canceledTransfers.clear();
    this.activeTransfers.clear();
    this.lastProgress.clear();
  }
}
