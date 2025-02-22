
import type { TransferProgress } from '../types/transfer';
import type { TransferControlMessage } from '../types/transfer-control';
import { TransferStore } from './TransferStore';
import { ProgressEmitter } from './ProgressEmitter';
import { TransferStateService } from './services/TransferStateService';
import { TransferProgressHandler } from './handlers/TransferProgressHandler';
import { TransferControlHandler } from './handlers/TransferControlHandler';

export class TransferStateManager {
  private stateService: TransferStateService;
  private progressHandler: TransferProgressHandler;
  private controlHandler: TransferControlHandler;

  constructor(onProgress?: (progress: TransferProgress) => void) {
    const progressEmitter = new ProgressEmitter(onProgress);
    this.stateService = new TransferStateService(progressEmitter);
    this.progressHandler = new TransferProgressHandler(this.stateService);
    this.controlHandler = new TransferControlHandler(this.stateService);
  }

  getCurrentTransfer() {
    return this.stateService.getCurrentTransfer();
  }

  isPaused() {
    return this.stateService.isPaused();
  }

  isCancelled() {
    return this.stateService.isCancelled();
  }

  isTransferActive(filename: string): boolean {
    return this.stateService.isTransferActive(filename);
  }

  startTransfer(filename: string, total: number) {
    try {
      this.stateService.startTransfer(filename, total);
    } catch (error) {
      console.error('[STATE] Error starting transfer:', error);
      this.reset();
    }
  }

  handlePause(message: TransferControlMessage): boolean {
    return this.controlHandler.handlePause(message);
  }

  handleResume(message: TransferControlMessage): boolean {
    return this.controlHandler.handleResume(message);
  }

  handleCancel(message: TransferControlMessage): void {
    this.controlHandler.handleCancel(message);
  }

  updateTransferProgress(
    filename: string,
    loaded: number,
    total: number,
    currentChunk: number,
    totalChunks: number
  ) {
    this.progressHandler.updateProgress(filename, loaded, total, currentChunk, totalChunks);
  }

  reset() {
    this.stateService.reset();
    this.controlHandler.reset();
  }
}
