
import type { TransferProgress } from '../types/transfer';
import type { TransferControl, TransferControlMessage, TransferState } from '../types/transfer-control';

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
    try {
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
      
      // Emit initial state
      this.updateProgress(filename, 'transferring');
    } catch (error) {
      console.error('[STATE] Error starting transfer:', error);
      this.reset();
    }
  }

  handlePause({ filename }: TransferControlMessage) {
    try {
      const currentTransfer = this.state.currentTransfer;
      if (!currentTransfer) {
        console.warn('[STATE] Cannot pause: no active transfer');
        return;
      }

      if (currentTransfer.filename !== filename) {
        console.warn('[STATE] Cannot pause: filename mismatch');
        return;
      }

      console.log('[STATE] Setting transfer to paused state for:', filename);
      this.state.isPaused = true;

      // Always emit full progress state when pausing
      if (currentTransfer.progress) {
        this.updateProgress(filename, 'paused', currentTransfer.progress);
      }
    } catch (error) {
      console.error('[STATE] Error handling pause:', error);
    }
  }

  handleResume({ filename }: TransferControlMessage) {
    try {
      const currentTransfer = this.state.currentTransfer;
      if (!currentTransfer) {
        console.warn('[STATE] Cannot resume: no active transfer');
        return;
      }

      if (currentTransfer.filename !== filename) {
        console.warn('[STATE] Cannot resume: filename mismatch');
        return;
      }

      console.log('[STATE] Setting transfer to resumed state for:', filename);
      this.state.isPaused = false;

      // Always emit full progress state when resuming
      if (currentTransfer.progress) {
        this.updateProgress(filename, 'transferring', currentTransfer.progress);
      }
    } catch (error) {
      console.error('[STATE] Error handling resume:', error);
    }
  }

  handleCancel({ filename, isReceiver }: TransferControlMessage) {
    try {
      if (!this.state.currentTransfer) {
        console.warn('[STATE] Cannot cancel: no active transfer');
        return;
      }

      this.state.isCancelled = true;
      this.state.isPaused = false;
      this.state.currentTransfer = null;
      this.updateProgress(filename, isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender');
    } catch (error) {
      console.error('[STATE] Error handling cancel:', error);
      this.reset();
    }
  }

  updateTransferProgress(filename: string, loaded: number, total: number, currentChunk: number, totalChunks: number) {
    try {
      const currentTransfer = this.state.currentTransfer;
      if (!currentTransfer) {
        console.warn('[STATE] Cannot update progress: no active transfer');
        return;
      }

      if (currentTransfer.filename !== filename) {
        console.warn('[STATE] Cannot update progress: filename mismatch');
        return;
      }

      currentTransfer.progress = {
        loaded,
        total,
        currentChunk,
        totalChunks
      };

      // Use requestAnimationFrame for smoother UI updates
      requestAnimationFrame(() => {
        if (currentTransfer.progress) {
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
    this.state = {
      isPaused: false,
      isCancelled: false,
      currentTransfer: null
    };
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
