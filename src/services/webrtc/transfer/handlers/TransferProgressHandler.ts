
import type { TransferState } from '../../types/transfer-control';
import { TransferStateService } from '../services/TransferStateService';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferProgressHandler {
  constructor(
    private stateService: TransferStateService,
    private progressEmitter: ProgressEmitter
  ) {}

  updateProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number
  ) {
    this.stateService.updateProgress(
      filename,
      loaded,
      total,
      currentChunk,
      totalChunks,
      this.stateService.isPaused() ? 'paused' : 'transferring'
    );
  }
}
