
import type { TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';
import { StateUpdateManager } from './StateUpdateManager';

export class TransferLifecycleManager {
  private isCleaningUp: boolean = false;

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter,
    private stateUpdateManager: StateUpdateManager
  ) {}

  startTransfer(filename: string, total: number) {
    try {
      console.log(`[STATE] Starting new transfer for ${filename}`);
      
      if (this.isCleaningUp) {
        console.log('[STATE] Cannot start new transfer while cleanup is in progress');
        return;
      }
      
      // Reset state first
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

      this.stateUpdateManager.debouncedStateUpdate(() => {
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

  reset() {
    console.log('[STATE] Resetting transfer state');
    this.stateUpdateManager.clearTimeouts();
    
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
    this.isCleaningUp = false;
  }

  startCleanup() {
    this.isCleaningUp = true;
  }

  endCleanup() {
    this.isCleaningUp = false;
  }

  isInCleanup(): boolean {
    return this.isCleaningUp;
  }
}
