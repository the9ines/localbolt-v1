
import type { TransferProgress } from '../types/transfer';
import type { TransferControlMessage, TransferState } from '../types/transfer-control';
import { TransferStore } from './TransferStore';
import { ProgressEmitter } from './ProgressEmitter';
import { TransferProgressHandler } from './handlers/TransferProgressHandler';
import { TransferControlHandler } from './handlers/TransferControlHandler';
import { v4 as uuidv4 } from 'uuid';

export class TransferStateManager {
  private store: TransferStore;
  private progressEmitter: ProgressEmitter;
  private progressHandler: TransferProgressHandler;
  private controlHandler: TransferControlHandler;
  private isCleaningUp: boolean = false;
  private stateUpdateTimeout: NodeJS.Timeout | null = null;
  private readonly STATE_UPDATE_DELAY = 16;
  private lastProgressUpdate: number = 0;
  private readonly PROGRESS_UPDATE_THRESHOLD = 50;
  private currentSessionId: string | null = null;

  constructor(onProgress?: (progress: TransferProgress) => void) {
    this.store = new TransferStore();
    this.progressEmitter = new ProgressEmitter(onProgress);
    this.progressHandler = new TransferProgressHandler(this.store, this.progressEmitter);
    this.controlHandler = new TransferControlHandler(this.store, this.progressEmitter);
  }

  private generateSessionId(): string {
    return uuidv4();
  }

  private debouncedStateUpdate(callback: () => void) {
    if (this.stateUpdateTimeout) {
      clearTimeout(this.stateUpdateTimeout);
    }

    this.stateUpdateTimeout = setTimeout(() => {
      if (!this.isCleaningUp) {
        callback();
      }
      this.stateUpdateTimeout = null;
    }, this.STATE_UPDATE_DELAY);
  }

  resetTransferState(reason: 'cancel' | 'disconnect' | 'error' | 'complete'): void {
    console.log(`[STATE] Resetting transfer state due to: ${reason}`);
    
    // Prevent new updates during cleanup
    this.isCleaningUp = true;

    try {
      // Clear any pending updates
      if (this.stateUpdateTimeout) {
        clearTimeout(this.stateUpdateTimeout);
        this.stateUpdateTimeout = null;
      }

      // Get current transfer for final event emission
      const currentTransfer = this.store.getCurrentTransfer();
      
      // Reset all state tracking
      this.store.clear();
      this.controlHandler.reset();
      this.lastProgressUpdate = 0;
      this.currentSessionId = null;

      // Emit final status if needed
      if (currentTransfer?.progress && reason !== 'complete') {
        const status = reason === 'cancel' ? 'canceled_by_sender' : 
                      reason === 'error' ? 'error' : 
                      'disconnected';
        
        this.progressEmitter.emit(
          currentTransfer.filename,
          status,
          currentTransfer.progress
        );
      }
    } finally {
      // Re-enable updates
      this.isCleaningUp = false;
    }
  }

  getCurrentTransfer() {
    return this.store.getCurrentTransfer();
  }

  startTransfer(filename: string, total: number) {
    try {
      console.log(`[STATE] Starting new transfer for ${filename}`);
      
      if (this.isCleaningUp) {
        console.log('[STATE] Cannot start new transfer while cleanup is in progress');
        return;
      }
      
      // Generate new session ID
      this.currentSessionId = this.generateSessionId();
      
      // Reset state before starting new transfer
      this.resetTransferState('complete');
      
      const newTransfer: TransferState = {
        filename,
        total,
        sessionId: this.currentSessionId,
        progress: {
          loaded: 0,
          total,
          currentChunk: 0,
          totalChunks: 0,
          lastUpdated: Date.now()
        }
      };

      this.debouncedStateUpdate(() => {
        this.store.setTransfer(newTransfer);
        this.store.updateState({
          isPaused: false,
          isCancelled: false,
          currentTransfer: newTransfer,
          activeSessionId: this.currentSessionId
        });
        
        console.log('[STATE] Transfer started, initial state:', newTransfer);
        this.progressEmitter.emit(filename, 'transferring');
      });
    } catch (error) {
      console.error('[STATE] Error starting transfer:', error);
      this.resetTransferState('error');
    }
  }

  updateProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number
  ) {
    const now = Date.now();
    if (now - this.lastProgressUpdate < this.PROGRESS_UPDATE_THRESHOLD) {
      return;
    }

    const transfer = this.store.getCurrentTransfer();
    
    // Verify active transfer and session
    if (!transfer || 
        transfer.filename !== filename || 
        transfer.sessionId !== this.currentSessionId ||
        this.isCleaningUp || 
        this.store.isCancelled()) {
      return;
    }

    this.lastProgressUpdate = now;

    this.debouncedStateUpdate(() => {
      this.progressHandler.updateProgress(
        filename,
        loaded,
        total,
        currentChunk,
        totalChunks
      );
    });
  }

  handlePause(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling pause request', message);
    if (this.isCleaningUp) return false;
    
    // Verify session ID if present
    if (message.sessionId && message.sessionId !== this.currentSessionId) {
      console.log('[STATE] Ignoring pause for inactive session');
      return false;
    }
    
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
    
    // Verify session ID if present
    if (message.sessionId && message.sessionId !== this.currentSessionId) {
      console.log('[STATE] Ignoring resume for inactive session');
      return false;
    }
    
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
    
    // Always allow cancellation regardless of session ID
    this.resetTransferState('cancel');
    this.controlHandler.handleCancel(message);
  }

  handleDisconnect(): void {
    console.log('[STATE] Handling disconnect');
    this.resetTransferState('disconnect');
  }

  handleError(): void {
    console.log('[STATE] Handling error');
    this.resetTransferState('error');
  }
}
