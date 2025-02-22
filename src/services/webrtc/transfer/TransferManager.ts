
import type { TransferProgress, FileChunkMessage } from '../types/transfer';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferProgressTracker } from './progress/TransferProgressTracker';
import { TransferBuffer } from './buffer/TransferBuffer';

export class TransferManager {
  private progressTracker: TransferProgressTracker;
  private buffer: TransferBuffer;
  private isPaused: boolean = false;

  constructor(
    private dataChannel: RTCDataChannel,
    private chunkProcessor: ChunkProcessor,
    onProgress?: (progress: TransferProgress) => void
  ) {
    this.progressTracker = new TransferProgressTracker(onProgress);
    this.buffer = new TransferBuffer();
  }

  getCurrentProgress(filename: string): TransferProgress {
    return this.progressTracker.getCurrentProgress(filename);
  }

  cancelTransfer(filename: string, isReceiver: boolean) {
    this.buffer.cleanupTransfer(filename);
    
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      cancelled: true,
      cancelledBy: isReceiver ? 'receiver' : 'sender'
    };
    
    this.dataChannel.send(JSON.stringify(message));
    this.handleCleanup(filename);
  }

  handleCleanup(filename: string) {
    if (this.buffer.isTransferActive(filename)) {
      const currentProgress = this.progressTracker.getCurrentProgress(filename);
      this.buffer.cleanupTransfer(filename);
      this.progressTracker.updateProgress(
        filename,
        0,
        currentProgress.totalChunks,
        0,
        0,
        'canceled_by_sender'
      );
    }
  }

  isTransferActive(filename: string): boolean {
    return this.buffer.isTransferActive(filename);
  }

  handlePause() {
    console.log('[TRANSFER-MANAGER] Transfer manager paused');
    this.isPaused = true;
  }

  handleResume() {
    console.log('[TRANSFER-MANAGER] Transfer manager resumed');
    this.isPaused = false;
  }

  isPauseActive() {
    return this.isPaused;
  }

  async processReceivedChunk(
    filename: string,
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
    fileSize: number
  ): Promise<Blob | null> {
    if (!this.buffer.isTransferActive(filename)) {
      console.log('[TRANSFER-MANAGER] Initializing new transfer:', {
        filename,
        totalChunks,
        fileSize
      });
      this.buffer.initializeTransfer(filename);
    }

    try {
      if (this.isPaused) {
        console.log('[TRANSFER-MANAGER] Skipping chunk processing while paused');
        return null;
      }

      const decryptedChunk = await this.chunkProcessor.decryptChunk(chunk);
      this.buffer.storeChunk(filename, chunkIndex, decryptedChunk);

      const chunks = this.buffer.getStoredChunks(filename);
      const received = chunks.filter(Boolean).length;
      const loaded = received * (fileSize / totalChunks);
      
      console.log('[TRANSFER-MANAGER] Chunk processed:', {
        filename,
        chunkIndex,
        received,
        totalChunks,
        loaded,
        fileSize
      });
      
      this.progressTracker.updateProgress(
        filename,
        received,
        totalChunks,
        loaded,
        fileSize
      );

      if (received === totalChunks) {
        console.log('[TRANSFER-MANAGER] Transfer complete:', filename);
        return this.buffer.completeTransfer(filename);
      }
    } catch (error) {
      console.error('[TRANSFER-MANAGER] Error processing chunk:', error);
      this.buffer.cleanupTransfer(filename);
      throw error;
    }

    return null;
  }
}
