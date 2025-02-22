
import type { TransferProgress } from '../types/transfer';
import type { TransferControl, TransferControlMessage, TransferState } from '../types/transfer-control';

export class TransferStateManager {
  private state: TransferControl = {
    isPaused: false,
    isCancelled: false,
    currentTransfer: null
  };

  private activeTransfers: Set<string> = new Set();

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

  isTransferActive(filename: string): boolean {
    return this.activeTransfers.has(filename);
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

      this.state = {
        isPaused: false,
        isCancelled: false,
        currentTransfer: newTransfer
      };
      
      this.activeTransfers.add(filename);
      console.log('[STATE] Transfer started, initial state:', this.state);
      this.updateProgress(filename, 'transferring');
    } catch (error) {
      console.error('[STATE] Error starting transfer:', error);
      this.reset();
    }
  }

  handlePause({ filename }: TransferControlMessage) {
    try {
      console.log(`[STATE] Processing pause request for ${filename}`);
      if (!this.isTransferActive(filename)) {
        console.warn(`[STATE] Cannot pause: ${filename} is not active`);
        return;
      }

      const currentTransfer = this.state.currentTransfer;
      if (!currentTransfer || currentTransfer.filename !== filename) {
        console.warn('[STATE] Cannot pause: filename mismatch');
        return;
      }

      console.log(`[STATE] Setting transfer to paused state for: ${filename}`);
      this.state.isPaused = true;

      if (currentTransfer.progress) {
        console.log('[STATE] Updating progress with paused status');
        this.updateProgress(filename, 'paused', currentTransfer.progress);
      }
    } catch (error) {
      console.error('[STATE] Error handling pause:', error);
    }
  }

  handleResume({ filename }: TransferControlMessage) {
    try {
      console.log(`[STATE] Processing resume request for ${filename}`);
      if (!this.isTransferActive(filename)) {
        console.warn(`[STATE] Cannot resume: ${filename} is not active`);
        return;
      }

      const currentTransfer = this.state.currentTransfer;
      if (!currentTransfer || currentTransfer.filename !== filename) {
        console.warn('[STATE] Cannot resume: filename mismatch');
        return;
      }

      console.log(`[STATE] Setting transfer to resumed state for: ${filename}`);
      this.state.isPaused = false;

      if (currentTransfer.progress) {
        console.log('[STATE] Updating progress with transferring status');
        this.updateProgress(filename, 'transferring', currentTransfer.progress);
      }
    } catch (error) {
      console.error('[STATE] Error handling resume:', error);
    }
  }

  handleCancel({ filename, isReceiver }: TransferControlMessage) {
    try {
      console.log(`[STATE] Processing cancel request for ${filename}`);
      if (!this.isTransferActive(filename)) {
        console.warn(`[STATE] Cannot cancel: ${filename} is not active`);
        return;
      }

      const status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      console.log(`[STATE] Setting transfer to ${status} state for: ${filename}`);

      const currentProgress = this.state.currentTransfer?.progress;

      this.state.isCancelled = true;
      this.state.isPaused = false;
      this.state.currentTransfer = null;
      this.activeTransfers.delete(filename);

      this.updateProgress(filename, status, currentProgress);

      setTimeout(() => {
        if (this.onProgress) {
          console.log('[STATE] Sending final progress update after cancel');
          this.onProgress({
            status,
            filename,
            currentChunk: 0,
            totalChunks: 0,
            loaded: 0,
            total: 0
          });
        }
      }, 100);
    } catch (error) {
      console.error('[STATE] Error handling cancel:', error);
      this.reset();
    }
  }

  updateTransferProgress(
    filename: string, 
    loaded: number, 
    total: number, 
    currentChunk: number, 
    totalChunks: number
  ) {
    try {
      console.log(`[STATE] Updating progress for ${filename}: ${currentChunk}/${totalChunks}`);
      if (!this.isTransferActive(filename)) {
        console.warn(`[STATE] Cannot update progress: ${filename} is not active`);
        return;
      }

      const currentTransfer = this.state.currentTransfer;
      if (!currentTransfer || currentTransfer.filename !== filename) {
        console.warn('[STATE] Cannot update progress: filename mismatch');
        return;
      }

      currentTransfer.progress = {
        loaded,
        total,
        currentChunk,
        totalChunks
      };

      requestAnimationFrame(() => {
        if (currentTransfer.progress) {
          console.log('[STATE] Emitting progress update');
          this.updateProgress(
            filename,
            this.state.isPaused ? 'paused' : 'transferring',
            currentTransfer.progress
          );
        }
      });
    } catch (error) {
      console.error('[STATE] Error updating transfer progress:', error);
    }
  }

  reset() {
    console.log('[STATE] Resetting transfer state');
    this.state = {
      isPaused: false,
      isCancelled: false,
      currentTransfer: null
    };
    this.activeTransfers.clear();
    
    if (this.onProgress) {
      console.log('[STATE] Sending reset progress update');
      this.onProgress({
        status: 'error',
        filename: '',
        currentChunk: 0,
        totalChunks: 0,
        loaded: 0,
        total: 0
      });
    }
  }

  private updateProgress(
    filename: string,
    status: 'transferring' | 'paused' | 'canceled_by_sender' | 'canceled_by_receiver' | 'error',
    progress?: {
      loaded: number;
      total: number;
      currentChunk: number;
      totalChunks: number;
    }
  ) {
    if (this.onProgress) {
      try {
        console.log(`[STATE] Emitting progress update - status: ${status}, filename: ${filename}`);
        this.onProgress({
          status,
          filename,
          currentChunk: progress?.currentChunk || 0,
          totalChunks: progress?.totalChunks || 0,
          loaded: progress?.loaded || 0,
          total: progress?.total || 0,
        });
      } catch (error) {
        console.error('[STATE] Error in progress callback:', error);
      }
    }
  }
}
