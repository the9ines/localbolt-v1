
import type { TransferProgress } from '../../types/transfer';
import type { TransferState, TransferControl } from '../../types/transfer-control';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferStateService {
  private activeTransfers: Map<string, TransferState> = new Map();
  private transferProgress: Map<string, TransferProgress> = new Map();
  private state: TransferControl = {
    isPaused: false,
    isCancelled: false,
    currentTransfer: null
  };

  constructor(private progressEmitter: ProgressEmitter) {}

  getCurrentTransfer(): TransferState | null {
    return this.state.currentTransfer;
  }

  isPaused(): boolean {
    return this.state.isPaused;
  }

  isCancelled(): boolean {
    return this.state.isCancelled;
  }

  isTransferActive(filename: string): boolean {
    return this.activeTransfers.has(filename);
  }

  getTransfer(filename: string): TransferState | undefined {
    return this.activeTransfers.get(filename);
  }

  getProgress(filename: string): TransferProgress {
    return (
      this.transferProgress.get(filename) || {
        filename,
        currentChunk: 0,
        totalChunks: 0,
        loaded: 0,
        total: 0
      }
    );
  }

  startTransfer(filename: string, total: number) {
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

    this.activeTransfers.set(filename, newTransfer);
    this.state = {
      ...this.state,
      isPaused: false,
      isCancelled: false,
      currentTransfer: newTransfer
    };

    console.log('[STATE] Transfer started, initial state:', newTransfer);
    this.progressEmitter.emit(filename, 'transferring');
  }

  updateProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number,
    status: TransferProgress['status'] = 'transferring'
  ) {
    const progress: TransferProgress = {
      filename,
      currentChunk,
      totalChunks,
      loaded,
      total,
      status
    };

    this.transferProgress.set(filename, progress);
    
    const transfer = this.getTransfer(filename);
    if (transfer) {
      transfer.progress = { loaded, total, currentChunk, totalChunks };
      this.activeTransfers.set(filename, transfer);
    }

    this.progressEmitter.emit(filename, status, { loaded, total, currentChunk, totalChunks });
  }

  updateState(newState: Partial<TransferControl>) {
    this.state = { ...this.state, ...newState };
  }

  removeTransfer(filename: string) {
    this.activeTransfers.delete(filename);
    this.transferProgress.delete(filename);
  }

  reset() {
    this.activeTransfers.clear();
    this.transferProgress.clear();
    this.state = {
      isPaused: false,
      isCancelled: false,
      currentTransfer: null
    };
  }
}
