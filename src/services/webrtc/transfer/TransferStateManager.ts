
import type { TransferProgress } from '../types/transfer';
import type { TransferControlMessage, TransferState } from '../types/transfer-control';
import { TransferStore } from './TransferStore';
import { ProgressEmitter } from './ProgressEmitter';
import { TransferProgressHandler } from './handlers/TransferProgressHandler';
import { TransferControlHandler } from './handlers/TransferControlHandler';

export class TransferStateManager {
  private store: TransferStore;
  private progressEmitter: ProgressEmitter;
  private progressHandler: TransferProgressHandler;
  private controlHandler: TransferControlHandler;

  constructor(onProgress?: (progress: TransferProgress) => void) {
    this.store = new TransferStore();
    this.progressEmitter = new ProgressEmitter(onProgress);
    this.progressHandler = new TransferProgressHandler(this.store, this.progressEmitter);
    this.controlHandler = new TransferControlHandler(this.store, this.progressEmitter);
  }

  getCurrentTransfer() {
    return this.store.getCurrentTransfer();
  }

  isPaused() {
    return this.store.isPaused();
  }

  isCancelled() {
    return this.store.isCancelled();
  }

  isTransferActive(filename: string): boolean {
    return this.store.isTransferActive(filename);
  }

  startTransfer(filename: string, total: number) {
    try {
      console.log(`[STATE] Starting new transfer for ${filename}`);
      
      // Clear any existing transfer state first
      this.reset();
      
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

      // Initialize transfer state
      this.store.setTransfer(newTransfer);
      this.store.updateState({
        isPaused: false,
        isCancelled: false,
        currentTransfer: newTransfer
      });
      
      console.log('[STATE] Transfer started, initial state:', newTransfer);
      this.progressEmitter.emit(filename, 'transferring');
    } catch (error) {
      console.error('[STATE] Error starting transfer:', error);
      this.reset();
    }
  }

  handlePause(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling pause request', message);
    const success = this.controlHandler.handlePause(message);
    if (success) {
      this.store.updateState({ isPaused: true });
    }
    return success;
  }

  handleResume(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling resume request', message);
    const success = this.controlHandler.handleResume(message);
    if (success) {
      this.store.updateState({ isPaused: false });
    }
    return success;
  }

  handleCancel(message: TransferControlMessage): void {
    console.log('[STATE] Handling cancel request', message);
    this.controlHandler.handleCancel(message);
    this.reset();
  }

  updateTransferProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number
  ) {
    // Create transfer if it doesn't exist
    if (!this.store.isTransferActive(filename)) {
      this.startTransfer(filename, total);
    }
    this.progressHandler.updateProgress(filename, loaded, total, currentChunk, totalChunks);
  }

  reset() {
    console.log('[STATE] Resetting transfer state');
    const currentTransfer = this.store.getCurrentTransfer();
    
    if (currentTransfer?.progress) {
      // Emit final progress update if transfer was in progress
      this.progressEmitter.emit(
        currentTransfer.filename,
        'transferring',
        currentTransfer.progress
      );
    }
    
    // Clear all state
    this.store.clear();
    this.controlHandler.reset();
  }
}
