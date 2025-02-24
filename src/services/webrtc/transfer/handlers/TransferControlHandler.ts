
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';
import { PauseResumeHandler } from './PauseResumeHandler';
import { CancellationHandler } from './CancellationHandler';

export class TransferControlHandler {
  private pauseResumeHandler: PauseResumeHandler;
  private cancellationHandler: CancellationHandler;
  private lastProgress: Map<string, TransferState['progress']> = new Map();
  private activeTransfers: Map<string, TransferState> = new Map();

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {
    this.pauseResumeHandler = new PauseResumeHandler(store, progressEmitter);
    this.cancellationHandler = new CancellationHandler(store, progressEmitter);
  }

  handlePause(message: TransferControlMessage): boolean {
    return this.pauseResumeHandler.handlePause(message);
  }

  handleResume(message: TransferControlMessage): boolean {
    return this.pauseResumeHandler.handleResume(message);
  }

  handleCancel(message: TransferControlMessage): void {
    this.cancellationHandler.handleCancel(message);
  }

  updateTransferProgress(filename: string, progress: TransferState['progress']): void {
    console.log('[STATE] Updating transfer progress:', { filename, progress });
    
    this.lastProgress.set(filename, progress);

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
    this.activeTransfers.set(filename, transfer);

    const status = this.store.isPaused() ? 'paused' : 'transferring';
    this.progressEmitter.emit(filename, status, progress);
  }

  markTransferActive(filename: string, total?: number): void {
    const currentProgress = this.lastProgress.get(filename);
    
    const transfer = {
      filename,
      total: total || currentProgress?.total || 0,
      progress: currentProgress || null
    };
    
    this.store.setTransfer(transfer);
    this.activeTransfers.set(filename, transfer);
  }

  reset(): void {
    console.log('[STATE] Resetting transfer state');
    this.store.clear();
    this.progressEmitter.emit('', 'error');
    this.cancellationHandler.reset();
    this.activeTransfers.clear();
    this.lastProgress.clear();
  }
}
