
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';
import { PauseResumeHandler } from './PauseResumeHandler';
import { CancelHandler } from './CancelHandler';

export class TransferControlHandler {
  private pauseResumeHandler: PauseResumeHandler;
  private cancelHandler: CancelHandler;

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {
    this.pauseResumeHandler = new PauseResumeHandler(store, progressEmitter);
    this.cancelHandler = new CancelHandler(
      store, 
      progressEmitter,
      (filename: string) => this.pauseResumeHandler.getLastProgress(filename)
    );
  }

  handlePause(message: TransferControlMessage): boolean {
    return this.pauseResumeHandler.handlePause(message);
  }

  handleResume(message: TransferControlMessage): boolean {
    return this.pauseResumeHandler.handleResume(message);
  }

  handleCancel(message: TransferControlMessage): void {
    this.cancelHandler.handleCancel(message);
  }

  updateTransferProgress(filename: string, progress: TransferState['progress']): void {
    console.log('[STATE] Updating transfer progress:', { filename, progress });
    
    this.pauseResumeHandler.setLastProgress(filename, progress);

    let transfer = this.store.getTransfer(filename);
    if (!transfer) {
      transfer = {
        filename,
        total: progress.total,
        progress: progress
      };
    } else {
      transfer.progress = progress;
    }

    this.store.setTransfer(transfer);

    const status = this.store.isPaused() ? 'paused' : 'transferring';
    this.progressEmitter.emit(filename, status, progress);
  }

  markTransferActive(filename: string, total?: number): void {
    const currentProgress = this.pauseResumeHandler.getLastProgress(filename);
    
    const transfer = {
      filename,
      total: total || currentProgress?.total || 0,
      progress: currentProgress || null
    };
    
    this.store.setTransfer(transfer);
  }

  reset(): void {
    console.log('[STATE] Resetting transfer state');
    this.store.clear();
    this.progressEmitter.emit('', 'error');
    this.pauseResumeHandler.clearProgress();
    this.cancelHandler.reset();
  }
}
