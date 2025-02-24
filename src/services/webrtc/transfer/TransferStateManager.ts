import type { TransferProgress } from '../types/transfer';
import type { TransferControlMessage, TransferState } from '../types/transfer-control';
import { TransferStore } from './TransferStore';
import { ProgressEmitter } from './ProgressEmitter';
import { TransferProgressHandler } from './handlers/TransferProgressHandler';
import { TransferControlHandler } from './handlers/TransferControlHandler';

export class TransferStateManager {
  private store: TransferStore;
  private progressEmitter: ProgressEmitter;
  private progressHandler: TransferProgressHandler;
  private controlHandler: TransferControlHandler;
  private resumptionData: Map<string, { chunks: Set<number>, total: number }> = new Map();

  constructor(onProgress?: (progress: TransferProgress) => void) {
    this.store = new TransferStore();
    this.progressEmitter = new ProgressEmitter(onProgress);
    this.progressHandler = new TransferProgressHandler(this.store, this.progressEmitter);
    this.controlHandler = new TransferControlHandler(this.store, this.progressEmitter);
  }

  getCurrentTransfer() {
    return this.store.getCurrentTransfer();
  }

  isPaused() {
    return this.store.isPaused();
  }

  isCancelled() {
    return this.store.isCancelled();
  }

  isTransferActive(filename: string): boolean {
    return this.store.isTransferActive(filename);
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

      this.resumptionData.set(filename, {
        chunks: new Set(),
        total: Math.ceil(total / this.getCurrentChunkSize())
      });

      // Initialize transfer state
      this.store.setTransfer(newTransfer);
      this.store.updateState({
        isPaused: false,
        isCancelled: false,
        currentTransfer: newTransfer
      });
      
      console.log('[STATE] Transfer started, initial state:', newTransfer);
      this.progressEmitter.emit(filename, 'transferring');
    } catch (error) {
      console.error('[STATE] Error starting transfer:', error);
      this.reset();
    }
  }

  handlePause(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling pause request', message);
    // Set pause state first
    this.store.updateState({ isPaused: true });
    
    // Let control handler update the progress
    return this.controlHandler.handlePause(message);
  }

  handleResume(message: TransferControlMessage): boolean {
    console.log('[STATE] Handling resume request', message);
    // Set resume state first
    this.store.updateState({ isPaused: false });
    
    // Let control handler update the progress
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
    // Track received chunks for resumption
    const resumption = this.resumptionData.get(filename);
    if (resumption) {
      resumption.chunks.add(currentChunk);
    }

    this.progressHandler.updateProgress(filename, loaded, total, currentChunk, totalChunks);
  }

  getMissingChunks(filename: string): number[] {
    const resumption = this.resumptionData.get(filename);
    if (!resumption) return [];

    const missing: number[] = [];
    for (let i = 0; i < resumption.total; i++) {
      if (!resumption.chunks.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }

  getCurrentChunkSize(): number {
    return 16384; // Default chunk size, should match BandwidthAdapter's BASE_CHUNK_SIZE
  }

  getResumptionState(filename: string) {
    return this.resumptionData.get(filename);
  }

  reset() {
    this.controlHandler.reset();
    this.resumptionData.clear();
  }
}
