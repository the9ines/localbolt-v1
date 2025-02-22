
import type { TransferControl, TransferState } from '../types/transfer-control';

export class TransferStore {
  private state: TransferControl = {
    isPaused: false,
    isCancelled: false,
    currentTransfer: null
  };

  private activeTransfers: Map<string, TransferState> = new Map();

  getCurrentTransfer() {
    return this.state.currentTransfer;
  }

  isPaused() {
    return this.state.isPaused;
  }

  isCancelled() {
    return this.state.isCancelled;
  }

  isTransferActive(filename: string): boolean {
    return this.activeTransfers.has(filename);
  }

  getTransfer(filename: string): TransferState | undefined {
    return this.activeTransfers.get(filename);
  }

  setTransfer(transfer: TransferState) {
    this.activeTransfers.set(transfer.filename, transfer);
  }

  updateState(newState: Partial<TransferControl>) {
    this.state = { ...this.state, ...newState };
  }

  deleteTransfer(filename: string) {
    this.activeTransfers.delete(filename);
  }

  clear() {
    this.state = {
      isPaused: false,
      isCancelled: false,
      currentTransfer: null
    };
    this.activeTransfers.clear();
  }
}
