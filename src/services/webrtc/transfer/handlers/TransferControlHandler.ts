
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';
import { ProgressManagerService } from '../services/ProgressManagerService';
import { TransferPauseService } from '../services/TransferPauseService';
import { TransferCancelService } from '../services/TransferCancelService';

export class TransferControlHandler {
  private progressManager: ProgressManagerService;
  private pauseService: TransferPauseService;
  private cancelService: TransferCancelService;

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {
    this.progressManager = new ProgressManagerService(store, progressEmitter);
    this.pauseService = new TransferPauseService(store, progressEmitter, this.progressManager);
    this.cancelService = new TransferCancelService(store, progressEmitter, this.progressManager);
  }

  handlePause(message: TransferControlMessage): boolean {
    return this.pauseService.handlePause(message);
  }

  handleResume(message: TransferControlMessage): boolean {
    return this.pauseService.handleResume(message);
  }

  handleCancel(message: TransferControlMessage): void {
    this.cancelService.handleCancel(message);
  }

  updateTransferProgress(filename: string, progress: TransferState['progress']): void {
    if (progress) {
      this.progressManager.updateProgress(
        filename,
        progress.loaded,
        progress.total,
        progress.currentChunk,
        progress.totalChunks,
        this.store.isPaused() ? 'paused' : 'transferring'
      );
    }
  }

  markTransferActive(filename: string, total?: number): void {
    const currentProgress = this.progressManager.getLastProgress(filename);
    
    // Create or update transfer state with current progress
    const transfer = {
      filename,
      total: total || currentProgress?.total || 0,
      progress: currentProgress || null
    };
    
    this.store.setTransfer(transfer);
    this.progressManager.setActiveTransfer(filename, transfer);
  }

  reset(): void {
    console.log('[STATE] Resetting transfer state');
    this.store.clear();
    this.progressEmitter.emit('', 'error');
    this.cancelService.reset();
    this.progressManager.clear();
  }
}
