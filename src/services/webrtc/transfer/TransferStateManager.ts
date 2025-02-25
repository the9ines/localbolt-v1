
import type { TransferProgress } from '../types/transfer';
import type { TransferControlMessage, TransferState } from '../types/transfer-control';
import { TransferStore } from './TransferStore';
import { ProgressEmitter } from './ProgressEmitter';
import { TransferProgressHandler } from './handlers/TransferProgressHandler';
import { TransferControlHandler } from './handlers/TransferControlHandler';
import { SessionManager } from './managers/SessionManager';
import { StateUpdateManager } from './managers/StateUpdateManager';
import { IStateManager } from './managers/BaseStateManager';

export class TransferStateManager implements IStateManager {
  private store: TransferStore;
  private progressEmitter: ProgressEmitter;
  private progressHandler: TransferProgressHandler;
  private controlHandler: TransferControlHandler;
  private sessionManager: SessionManager;
  private stateUpdateManager: StateUpdateManager;
  private isResetting: boolean = false;

  constructor(onProgress?: (progress: TransferProgress) => void) {
    this.store = new TransferStore();
    this.progressEmitter = new ProgressEmitter(onProgress);
    this.progressHandler = new TransferProgressHandler(this.store, this.progressEmitter);
    this.controlHandler = new TransferControlHandler(this.store, this.progressEmitter);
    this.sessionManager = new SessionManager();
    this.stateUpdateManager = new StateUpdateManager();
    
    console.log('[STATE] TransferStateManager initialized');
  }

  reset(): void {
    if (this.isResetting) {
      console.log('[STATE] Reset already in progress, skipping');
      return;
    }
    
    this.isResetting = true;
    console.log('[STATE] Full reset of transfer state');
    
    try {
      // Get current transfer before resetting for a final status update
      const currentTransfer = this.store.getCurrentTransfer();
      
      // Reset all components
      this.resetTransferState('complete');
      this.store.clear();
      this.controlHandler.reset();
      this.sessionManager.clearSession();
      this.stateUpdateManager.reset();
      this.progressHandler.reset();
      this.progressEmitter.reset();
      
      // Send a final "canceled" state update if there was an active transfer
      if (currentTransfer?.filename) {
        console.log(`[STATE] Sending final canceled state update for ${currentTransfer.filename}`);
        this.progressEmitter.emit(currentTransfer.filename, 'canceled_by_sender');
      }
      
      console.log('[STATE] Transfer state fully reset');
    } finally {
      this.isResetting = false;
    }
  }

  resetTransferState(reason: 'cancel' | 'disconnect' | 'error' | 'complete'): void {
    console.log(`[STATE] Resetting transfer state due to: ${reason}`);
    this.stateUpdateManager.cleanup();

    try {
      const currentTransfer = this.store.getCurrentTransfer();
      
      // Clear state update queue
      this.stateUpdateManager.cleanup();
      
      // Cancel any pending state updates
      this.stateUpdateManager.reset();
      
      // Reset store state
      this.store.updateState({
        isPaused: false,
        isCancelled: true,
        currentTransfer: null,
        activeSessionId: undefined
      });
      
      // Emit final status if needed
      if (currentTransfer?.filename && reason !== 'complete') {
        const status = reason === 'cancel' ? 'canceled_by_sender' : 
                      reason === 'error' ? 'error' : 
                      'canceled_by_sender'; // Use canceled_by_sender for disconnect
        
        console.log(`[STATE] Emitting final ${status} state for ${currentTransfer.filename}`);
        this.progressEmitter.emit(
          currentTransfer.filename,
          status,
          currentTransfer.progress
        );
        
        // Also remove the transfer from store to prevent it from being reused
        this.store.deleteTransfer(currentTransfer.filename);
      }
      
      console.log(`[STATE] Transfer state reset completed for reason: ${reason}`);
    } catch (error) {
      console.error('[STATE] Error during transfer state reset:', error);
    } finally {
      this.stateUpdateManager.reset();
    }
  }

  getCurrentTransfer(): TransferState | null {
    return this.store.getCurrentTransfer();
  }

  startTransfer(filename: string, total: number): void {
    try {
      console.log(`[STATE] Starting new transfer for ${filename} (${total} bytes)`);
      
      if (this.stateUpdateManager.isProcessingCleanup()) {
        console.log('[STATE] Cannot start new transfer while cleanup is in progress');
        return;
      }
      
      // Reset any previous state for this file
      if (this.store.isTransferActive(filename)) {
        console.log(`[STATE] Clearing previous transfer state for ${filename}`);
        this.store.deleteTransfer(filename);
      }
      
      // Generate new session
      const sessionId = this.sessionManager.generateNewSession();
      
      // Reset any existing transfer first
      this.resetTransferState('complete');
      
      const newTransfer: TransferState = {
        filename,
        total,
        sessionId,
        file: null, // Will be set by SendFileService
        progress: {
          loaded: 0,
          total,
          currentChunk: 0,
          totalChunks: 0,
          lastUpdated: Date.now()
        }
      };

      this.stateUpdateManager.debounceUpdate(() => {
        this.store.setTransfer(newTransfer);
        this.store.updateState({
          isPaused: false,
          isCancelled: false,
          currentTransfer: newTransfer,
          activeSessionId: sessionId
        });
        
        console.log('[STATE] Transfer started, initial state:', newTransfer);
        this.progressEmitter.emit(filename, 'transferring', {
          loaded: 0,
          total,
          currentChunk: 0,
          totalChunks: 0
        });
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
  ): void {
    if (!this.stateUpdateManager.shouldUpdateProgress()) {
      return;
    }

    const transfer = this.store.getCurrentTransfer();
    
    if (!transfer || 
        transfer.filename !== filename || 
        !this.sessionManager.isValidSession(transfer.sessionId) ||
        this.stateUpdateManager.isProcessingCleanup() || 
        this.store.isCancelled()) {
      return;
    }

    this.stateUpdateManager.debounceUpdate(() => {
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
    if (this.stateUpdateManager.isProcessingCleanup()) return false;
    
    if (!this.sessionManager.isValidSession(message.sessionId)) {
      console.log('[STATE] Ignoring pause for inactive session');
      return false;
    }
    
    const success = this.controlHandler.handlePause(message);
    if (success) {
      this.stateUpdateManager.debounceUpdate(() => {
        this.store.updateState({ isPaused: true });
      });
    }
    return success;
  }

  handleResume(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling resume request', message);
    if (this.stateUpdateManager.isProcessingCleanup()) return false;
    
    if (!this.sessionManager.isValidSession(message.sessionId)) {
      console.log('[STATE] Ignoring resume for inactive session');
      return false;
    }
    
    const success = this.controlHandler.handleResume(message);
    if (success) {
      this.stateUpdateManager.debounceUpdate(() => {
        this.store.updateState({ isPaused: false });
      });
    }
    return success;
  }

  handleCancel(message: TransferControlMessage): void {
    console.log('[STATE] Handling cancel request', message);
    
    // Even if it's for an old session, we should force a cleanup
    this.resetTransferState('cancel');
    
    // Also handle through control handler for good measure
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

  isCancelled(): boolean {
    return this.store.isCancelled();
  }

  isPaused(): boolean {
    return this.store.isPaused();
  }
}
