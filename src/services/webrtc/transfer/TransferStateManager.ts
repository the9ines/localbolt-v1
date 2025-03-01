
import type { TransferProgress } from '../types/transfer';
import type { TransferControlMessage } from '../types/transfer-control';
import { TransferStore } from './TransferStore';
import { ProgressEmitter } from './ProgressEmitter';
import { TransferProgressHandler } from './handlers/TransferProgressHandler';
import { TransferControlHandler } from './handlers/TransferControlHandler';
import { StateUpdateManager } from './managers/StateUpdateManager';
import { ProgressUpdateManager } from './managers/ProgressUpdateManager';
import { TransferLifecycleManager } from './managers/TransferLifecycleManager';

export class TransferStateManager {
  private store: TransferStore;
  private progressEmitter: ProgressEmitter;
  private progressHandler: TransferProgressHandler;
  private controlHandler: TransferControlHandler;
  private stateUpdateManager: StateUpdateManager;
  private progressUpdateManager: ProgressUpdateManager;
  private lifecycleManager: TransferLifecycleManager;

  constructor(onProgress?: (progress: TransferProgress) => void) {
    this.store = new TransferStore();
    this.progressEmitter = new ProgressEmitter(onProgress);
    this.progressHandler = new TransferProgressHandler(this.store, this.progressEmitter);
    this.controlHandler = new TransferControlHandler(this.store, this.progressEmitter);
    this.stateUpdateManager = new StateUpdateManager();
    this.progressUpdateManager = new ProgressUpdateManager(this.store, this.progressEmitter);
    this.lifecycleManager = new TransferLifecycleManager(
      this.store,
      this.progressEmitter,
      this.stateUpdateManager
    );
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
    this.lifecycleManager.startTransfer(filename, total);
  }

  updateProgress(progress: TransferProgress): void {
    if (this.lifecycleManager.isInCleanup() || this.store.isCancelled()) {
      return;
    }

    if (!this.progressUpdateManager.shouldUpdateProgress()) {
      return;
    }

    this.progressEmitter.emit(
      progress.filename, 
      progress.status || 'transferring', 
      progress
    );
  }

  handlePause(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling pause request', message);
    if (this.lifecycleManager.isInCleanup()) return false;
    
    const success = this.controlHandler.handlePause(message);
    if (success) {
      this.stateUpdateManager.debouncedStateUpdate(() => {
        this.store.updateState({ isPaused: true });
      });
    }
    return success;
  }

  handleResume(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling resume request', message);
    if (this.lifecycleManager.isInCleanup()) return false;
    
    const success = this.controlHandler.handleResume(message);
    if (success) {
      this.stateUpdateManager.debouncedStateUpdate(() => {
        this.store.updateState({ isPaused: false });
      });
    }
    return success;
  }

  handleCancel(message: TransferControlMessage): void {
    console.log('[STATE] Handling cancel request', message);
    if (this.lifecycleManager.isInCleanup()) return;
    
    this.lifecycleManager.startCleanup();
    
    try {
      this.controlHandler.handleCancel(message);
    } finally {
      this.stateUpdateManager.debouncedStateUpdate(() => {
        this.reset();
      });
    }
  }

  updateTransferProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number
  ) {
    this.progressUpdateManager.updateTransferProgress(
      filename,
      loaded,
      total,
      currentChunk,
      totalChunks
    );
  }

  reset() {
    this.lifecycleManager.reset();
    this.controlHandler.reset();
    this.progressUpdateManager.reset();
  }
}
