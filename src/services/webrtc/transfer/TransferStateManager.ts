
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
      this.progressEmitter.emit(filename, 'transferring', {
        loaded: 0,
        total,
        currentChunk: 0,
        totalChunks: Math.ceil(total / 16384) // 16KB chunks
      });
    } catch (error) {
      console.error('[STATE] Error starting transfer:', error);
      this.reset();
    }
  }

  handlePause(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling pause request', message);
    // Set pause state first
    this.store.updateState({ isPaused: true });
    
    // Let control handler update the progress
    return this.controlHandler.handlePause(message);
  }

  handleResume(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling resume request', message);
    // Set resume state first
    this.store.updateState({ isPaused: false });
    
    // Let control handler update the progress
    return this.controlHandler.handleResume(message);
  }

  handleCancel(message: TransferControlMessage): void {
    console.log('[STATE] Handling cancel request', message);
    this.store.updateState({ isCancelled: true });
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
    this.progressHandler.updateProgress(filename, loaded, total, currentChunk, totalChunks);
  }

  reset() {
    console.log('[STATE] Resetting transfer state');
    this.store.updateState({
      isPaused: false,
      isCancelled: false,
      currentTransfer: null
    });
    this.controlHandler.reset();
  }
}
