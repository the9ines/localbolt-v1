
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
  }

  handlePause({ filename }: TransferControlMessage) {
    if (this.state.currentTransfer?.filename === filename) {
      this.state.isPaused = true;
      this.updateProgress(filename, 'paused');
    }
  }

  handleResume({ filename }: TransferControlMessage) {
    if (this.state.currentTransfer?.filename === filename) {
      this.state.isPaused = false;
      this.updateProgress(filename, 'transferring');
    }
  }

  handleCancel({ filename, isReceiver }: TransferControlMessage) {
    this.state.isCancelled = true;
    this.state.isPaused = false;
    this.state.currentTransfer = null;
    this.updateProgress(filename, isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender');
  }

  reset() {
    this.state = {
      isPaused: false,
      isCancelled: false,
      currentTransfer: null
    };
  }

  private updateProgress(filename: string, status: TransferProgress['status']) {
    if (this.onProgress) {
      this.onProgress({
        filename,
        currentChunk: 0,
        totalChunks: 0,
        loaded: 0,
        total: 0,
        status
      });
    }
  }
}
