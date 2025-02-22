
import type { TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';
import { ProgressManagerService } from '../services/ProgressManagerService';

export class TransferProgressHandler {
  private progressManager: ProgressManagerService;

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {
    this.progressManager = new ProgressManagerService(store, progressEmitter);
  }

  updateProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number
  ) {
    this.progressManager.updateProgress(
      filename,
      loaded,
      total,
      currentChunk,
      totalChunks,
      this.store.isPaused() ? 'paused' : 'transferring'
    );
  }
}
