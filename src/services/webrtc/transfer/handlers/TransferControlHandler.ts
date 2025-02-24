
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';
import { PauseHandler } from './PauseHandler';
import { ResumeHandler } from './ResumeHandler';
import { CancelHandler } from './CancelHandler';
import { BaseTransferHandler } from './base/BaseTransferHandler';

export class TransferControlHandler extends BaseTransferHandler {
  private pauseHandler: PauseHandler;
  private resumeHandler: ResumeHandler;
  private cancelHandler: CancelHandler;

  constructor(store: TransferStore, progressEmitter: ProgressEmitter) {
    super(store, progressEmitter);
    this.pauseHandler = new PauseHandler(store, progressEmitter);
    this.resumeHandler = new ResumeHandler(store, progressEmitter);
    this.cancelHandler = new CancelHandler(store, progressEmitter);
  }

  handlePause(message: TransferControlMessage): boolean {
    return this.pauseHandler.handlePause(message);
  }

  handleResume(message: TransferControlMessage): boolean {
    return this.resumeHandler.handleResume(message);
  }

  handleCancel(message: TransferControlMessage): void {
    this.cancelHandler.handleCancel(message);
  }

  updateTransferProgress(filename: string, progress: TransferState['progress']): void {
    console.log('[STATE] Updating transfer progress:', { filename, progress });
    
    this.lastProgress.set(filename, progress);
    const transfer = this.getOrCreateTransferState(filename);
    transfer.progress = progress;

    this.updateTransferState(transfer);

    const status = this.store.isPaused() ? 'paused' : 'transferring';
    this.emitProgressUpdate(filename, status, progress);
  }

  markTransferActive(filename: string, total?: number): void {
    const currentProgress = this.lastProgress.get(filename);
    
    const transfer = {
      filename,
      total: total || currentProgress?.total || 0,
      progress: currentProgress || null
    };
    
    this.updateTransferState(transfer);
  }

  reset(): void {
    console.log('[STATE] Resetting transfer state');
    this.store.clear();
    this.progressEmitter.emit('', 'error');
    this.activeTransfers.clear();
    this.lastProgress.clear();
    this.cancelHandler.reset();
  }
}
