
import type { TransferProgress, FileChunkMessage } from '../types/transfer';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferError } from '@/types/webrtc-errors';
import { TransferStorageHandler } from './handlers/TransferStorageHandler';
import { ChunkHandler } from './handlers/ChunkHandler';
import { RetryHandler } from './handlers/RetryHandler';
import { ProgressManager } from './managers/ProgressManager';
import { ChunkProcessingManager } from './managers/ChunkProcessingManager';

export class TransferManager {
  private activeTransfers: Set<string> = new Set();
  private isPaused: boolean = false;
  
  private storageHandler: TransferStorageHandler;
  private progressManager: ProgressManager;
  private chunkProcessingManager: ChunkProcessingManager;

  constructor(
    private dataChannel: RTCDataChannel,
    chunkProcessor: ChunkProcessor,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.storageHandler = new TransferStorageHandler();
    this.progressManager = new ProgressManager(this.storageHandler, onProgress);
    
    const chunkHandler = new ChunkHandler(chunkProcessor);
    const retryHandler = new RetryHandler();
    
    this.chunkProcessingManager = new ChunkProcessingManager(
      chunkHandler,
      retryHandler,
      (filename, loaded, total, status) => this.progressManager.updateProgress(filename, loaded, total, status)
    );
    
    this.loadSavedProgress();
  }

  private loadSavedProgress() {
    const { progress, chunks } = this.storageHandler.loadSavedProgress();
    this.progressManager.setProgress(progress);
    this.chunkProcessingManager.setChunksBuffer(chunks);
  }

  getCurrentProgress(filename: string): TransferProgress {
    return this.progressManager.getCurrentProgress(filename);
  }

  async processReceivedChunk(
    filename: string,
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
    fileSize: number
  ): Promise<Blob | null> {
    if (!this.isTransferActive(filename)) {
      this.activeTransfers.add(filename);
    }

    try {
      if (this.isPaused) {
        console.log('[TRANSFER] Skipping chunk processing while paused');
        return null;
      }

      const { file, received } = await this.chunkProcessingManager.processChunk(
        filename,
        chunk,
        chunkIndex,
        totalChunks,
        fileSize
      );

      if (file) {
        this.activeTransfers.delete(filename);
      }

      return file;

    } catch (error) {
      this.activeTransfers.delete(filename);
      this.chunkProcessingManager.cleanup(filename);
      throw error;
    }
  }

  cancelTransfer(filename: string, isReceiver: boolean) {
    this.activeTransfers.delete(filename);
    this.chunkProcessingManager.cleanup(filename);
    
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      cancelled: true,
      cancelledBy: isReceiver ? 'receiver' : 'sender'
    };
    
    this.dataChannel.send(JSON.stringify(message));
    this.handleCleanup(filename);
  }

  async handleCleanup(filename: string) {
    this.chunkProcessingManager.cleanup(filename);
    await this.progressManager.updateProgress(filename, 0, 0, 'canceled_by_sender');
  }

  requestMissingChunks(filename: string, missingChunks: number[]): void {
    console.log(`[TRANSFER] Requesting missing chunks for ${filename}:`, missingChunks);
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      requestMissingChunks: true,
      missingChunks
    };
    this.dataChannel.send(JSON.stringify(message));
  }

  handlePause() {
    console.log('[TRANSFER] Transfer manager paused');
    this.isPaused = true;
  }

  handleResume() {
    console.log('[TRANSFER] Transfer manager resumed');
    this.isPaused = false;
  }

  isPauseActive() {
    return this.isPaused;
  }

  isTransferActive(filename: string): boolean {
    return this.activeTransfers.has(filename);
  }
}
