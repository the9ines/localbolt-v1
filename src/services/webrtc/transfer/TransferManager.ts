import type { TransferProgress, FileChunkMessage } from '../types/transfer';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferError } from '@/types/webrtc-errors';
import { TransferStorageHandler } from './handlers/TransferStorageHandler';
import { ChunkHandler } from './handlers/ChunkHandler';
import { RetryHandler } from './handlers/RetryHandler';

export class TransferManager {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private activeTransfers: Set<string> = new Set();
  private transferProgress: { [key: string]: TransferProgress } = {};
  private isPaused: boolean = false;
  
  private storageHandler: TransferStorageHandler;
  private chunkHandler: ChunkHandler;
  private retryHandler: RetryHandler;

  constructor(
    private dataChannel: RTCDataChannel,
    chunkProcessor: ChunkProcessor,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.chunkHandler = new ChunkHandler(chunkProcessor);
    this.storageHandler = new TransferStorageHandler();
    this.retryHandler = new RetryHandler();
    this.loadSavedProgress();
  }

  private loadSavedProgress() {
    const { progress, chunks } = this.storageHandler.loadSavedProgress();
    this.transferProgress = progress;
    this.chunksBuffer = chunks;
  }

  private async saveProgress() {
    await this.storageHandler.saveProgress(this.transferProgress, this.chunksBuffer);
  }

  getCurrentProgress(filename: string): TransferProgress {
    return this.transferProgress[filename] || {
      filename,
      currentChunk: 0,
      totalChunks: 0,
      loaded: 0,
      total: 0
    };
  }

  private async updateProgress(
    filename: string,
    loaded: number,
    total: number,
    status: TransferProgress['status'] = 'transferring'
  ) {
    const progress: TransferProgress = {
      filename,
      currentChunk: 0,
      totalChunks: 0,
      loaded,
      total,
      status
    };

    this.transferProgress[filename] = progress;
    await this.saveProgress();

    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  cancelTransfer(filename: string, isReceiver: boolean) {
    this.activeTransfers.delete(filename);
    
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
    if (this.chunksBuffer[filename]) {
      delete this.chunksBuffer[filename];
      delete this.transferProgress[filename];
      await this.saveProgress();
      await this.updateProgress(filename, 0, 0, 'canceled_by_sender');
    }
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

  async processReceivedChunk(
    filename: string,
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
    fileSize: number
  ): Promise<Blob | null> {
    if (!this.chunksBuffer[filename]) {
      this.chunksBuffer[filename] = new Array(totalChunks);
      this.activeTransfers.add(filename);
    }

    const chunkKey = `${filename}-${chunkIndex}`;

    try {
      if (this.isPaused) {
        console.log('[TRANSFER] Skipping chunk processing while paused');
        return null;
      }

      const result = await this.retryHandler.executeWithRetry(
        chunkKey,
        async () => {
          const { received } = await this.chunkHandler.processChunk(
            chunk,
            chunkIndex,
            this.chunksBuffer[filename],
            fileSize,
            totalChunks
          );

          await this.updateProgress(
            filename,
            received * (fileSize / totalChunks),
            fileSize,
            'transferring'
          );

          return { received };
        },
        (attempt, delay) => {
          console.log(`[RETRY] Attempt ${attempt} for chunk ${chunkIndex} of ${filename}, next retry in ${delay}ms`);
        }
      );

      if (result.received === totalChunks) {
        await this.updateProgress(filename, fileSize, fileSize, 'validating');
        
        const { file, checksum } = await this.chunkHandler.finalizeFile(
          this.chunksBuffer[filename]
        );
        
        this.activeTransfers.delete(filename);
        delete this.chunksBuffer[filename];
        
        this.transferProgress[filename].checksum = checksum;
        await this.saveProgress();
        
        if (this.onProgress) {
          this.onProgress(this.transferProgress[filename]);
        }
        
        return file;
      }
    } catch (error) {
      this.activeTransfers.delete(filename);
      delete this.chunksBuffer[filename];
      throw error;
    }

    return null;
  }

  handlePause() {
    console.log('[TRANSFER] Transfer manager paused');
    this.isPaused = true;
    this.saveProgress();
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
