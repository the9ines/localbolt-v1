
import type { TransferProgress } from '../types/transfer';
import type { TransferControl, TransferControlMessage } from '../types/transfer-control';

export class TransferStateManager {
  private state: TransferControl = {
    isPaused: false,
    isCancelled: false,
    currentTransfer: null
  };

  constructor(private onProgress?: (progress: TransferProgress) => void) {}

  getCurrentTransfer() {
    return this.state.currentTransfer;
  }

  isPaused() {
    return this.state.isPaused;
  }

  isCancelled() {
    return this.state.isCancelled;
  }

  startTransfer(filename: string, total: number) {
    this.state = {
      isPaused: false,
      isCancelled: false,
      currentTransfer: { filename, total }
    };
    // Emit initial state
    this.updateProgress(filename, 'transferring');
  }

  handlePause({ filename }: TransferControlMessage) {
    if (this.state.currentTransfer?.filename === filename) {
      console.log('[STATE] Setting transfer to paused state for:', filename);
      this.state.isPaused = true;
      // Always emit full progress state when pausing
      this.updateProgress(filename, 'paused', {
        loaded: this.state.currentTransfer.progress?.loaded || 0,
        total: this.state.currentTransfer.total,
        currentChunk: this.state.currentTransfer.progress?.currentChunk || 0,
        totalChunks: this.state.currentTransfer.progress?.totalChunks || 0
      });
    }
  }

  handleResume({ filename }: TransferControlMessage) {
    if (this.state.currentTransfer?.filename === filename) {
      console.log('[STATE] Setting transfer to resumed state for:', filename);
      this.state.isPaused = false;
      // Always emit full progress state when resuming
      this.updateProgress(filename, 'transferring', {
        loaded: this.state.currentTransfer.progress?.loaded || 0,
        total: this.state.currentTransfer.total,
        currentChunk: this.state.currentTransfer.progress?.currentChunk || 0,
        totalChunks: this.state.currentTransfer.progress?.totalChunks || 0
      });
    }
  }

  handleCancel({ filename, isReceiver }: TransferControlMessage) {
    this.state.isCancelled = true;
    this.state.isPaused = false;
    this.state.currentTransfer = null;
    this.updateProgress(filename, isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender');
  }

  updateTransferProgress(filename: string, loaded: number, total: number, currentChunk: number, totalChunks: number) {
    if (this.state.currentTransfer?.filename === filename) {
      this.state.currentTransfer.progress = {
        loaded,
        total,
        currentChunk,
        totalChunks
      };
      this.updateProgress(
        filename,
        this.state.isPaused ? 'paused' : 'transferring',
        { loaded, total, currentChunk, totalChunks }
      );
    }
  }

  reset() {
    this.state = {
      isPaused: false,
      isCancelled: false,
      currentTransfer: null
    };
  }

  private updateProgress(
    filename: string,
    status: TransferProgress['status'],
    progress?: {
      loaded: number;
      total: number;
      currentChunk: number;
      totalChunks: number;
    }
  ) {
    if (this.onProgress) {
      this.onProgress({
        filename,
        currentChunk: progress?.currentChunk || 0,
        totalChunks: progress?.totalChunks || 0,
        loaded: progress?.loaded || 0,
        total: progress?.total || 0,
        status
      });
    }
  }
}
