
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
  private isCleaningUp: boolean = false;
  private stateUpdateTimeout: NodeJS.Timeout | null = null;
  private readonly STATE_UPDATE_DELAY = 16; // ~1 frame @ 60fps
  private lastProgressUpdate: number = 0;
  private readonly PROGRESS_UPDATE_THRESHOLD = 50; // 50ms minimum between updates

  constructor(onProgress?: (progress: TransferProgress) => void) {
    this.store = new TransferStore();
    this.progressEmitter = new ProgressEmitter(onProgress);
    this.progressHandler = new TransferProgressHandler(this.store, this.progressEmitter);
    this.controlHandler = new TransferControlHandler(this.store, this.progressEmitter);
  }

  private debouncedStateUpdate(callback: () => void) {
    if (this.stateUpdateTimeout) {
      clearTimeout(this.stateUpdateTimeout);
    }

    this.stateUpdateTimeout = setTimeout(() => {
      callback();
      this.stateUpdateTimeout = null;
    }, this.STATE_UPDATE_DELAY);
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
      
      if (this.isCleaningUp) {
        console.log('[STATE] Cannot start new transfer while cleanup is in progress');
        return;
      }
      
      // Ensure clean state before starting new transfer
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

      this.lastProgressUpdate = Date.now();

      this.debouncedStateUpdate(() => {
        // Initialize transfer state
        this.store.setTransfer(newTransfer);
        this.store.updateState({
          isPaused: false,
          isCancelled: false,
          currentTransfer: newTransfer
        });
        
        console.log('[STATE] Transfer started, initial state:', newTransfer);
        this.progressEmitter.emit(filename, 'transferring');
      });
    } catch (error) {
      console.error('[STATE] Error starting transfer:', error);
      this.reset();
    }
  }

  updateProgress(progress: TransferProgress): void {
    const now = Date.now();
    if (now - this.lastProgressUpdate < this.PROGRESS_UPDATE_THRESHOLD) {
      return; // Skip update if too soon
    }

    if (!this.isCleaningUp && !this.store.isCancelled()) {
      this.lastProgressUpdate = now;
      this.progressEmitter.emit(progress.filename, progress.status || 'transferring', progress);
    }
  }

  handlePause(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling pause request', message);
    if (this.isCleaningUp) return false;
    
    const success = this.controlHandler.handlePause(message);
    if (success) {
      this.debouncedStateUpdate(() => {
        this.store.updateState({ isPaused: true });
      });
    }
    return success;
  }

  handleResume(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling resume request', message);
    if (this.isCleaningUp) return false;
    
    const success = this.controlHandler.handleResume(message);
    if (success) {
      this.debouncedStateUpdate(() => {
        this.store.updateState({ isPaused: false });
      });
    }
    return success;
  }

  handleCancel(message: TransferControlMessage): void {
    console.log('[STATE] Handling cancel request', message);
    if (this.isCleaningUp) return;
    
    this.isCleaningUp = true;
    
    try {
      this.controlHandler.handleCancel(message);
    } finally {
      this.debouncedStateUpdate(() => {
        this.reset();
        this.isCleaningUp = false;
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
    // Don't update progress if we're cleaning up
    if (this.isCleaningUp || this.store.isCancelled()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastProgressUpdate < this.PROGRESS_UPDATE_THRESHOLD) {
      return; // Skip update if too soon
    }

    // Create transfer if it doesn't exist
    if (!this.store.isTransferActive(filename)) {
      this.startTransfer(filename, total);
    }

    this.lastProgressUpdate = now;
    this.debouncedStateUpdate(() => {
      this.progressHandler.updateProgress(filename, loaded, total, currentChunk, totalChunks);
    });
  }

  reset() {
    console.log('[STATE] Resetting transfer state');
    if (this.stateUpdateTimeout) {
      clearTimeout(this.stateUpdateTimeout);
      this.stateUpdateTimeout = null;
    }
    
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
    this.lastProgressUpdate = 0;
  }
}
