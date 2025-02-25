
import type { TransferProgress, FileChunkMessage } from '../types/transfer';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferError } from '@/types/webrtc-errors';

export class TransferManager {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private activeTransfers: Set<string> = new Set();
  private chunkProcessor: ChunkProcessor;
  private transferProgress: { [key: string]: TransferProgress } = {};
  private isPaused: boolean = false;
  private lastChunkProcessed: { [key: string]: number } = {};

  constructor(
    private dataChannel: RTCDataChannel,
    chunkProcessor: ChunkProcessor,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.chunkProcessor = chunkProcessor;
    console.log('[TRANSFER-MANAGER] Initialized with progress callback:', !!onProgress);
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

  private updateProgress(
    filename: string,
    currentChunk: number,
    totalChunks: number,
    loaded: number,
    total: number,
    status: TransferProgress['status'] = 'transferring'
  ) {
    // Always force a progress update for every chunk
    const progress: TransferProgress = {
      filename,
      currentChunk,
      totalChunks,
      loaded,
      total,
      status,
      timestamp: Date.now()
    };

    this.transferProgress[filename] = progress;

    // Log every progress update for debugging
    console.log(`[TRANSFER-MANAGER] Progress update for ${filename}:`, {
      currentChunk,
      totalChunks,
      loaded,
      total,
      status
    });

    if (this.onProgress) {
      // Send every update to listeners
      this.onProgress(progress);
    } else {
      console.warn(`[TRANSFER-MANAGER] No progress callback registered for ${filename}`);
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

  handleCleanup(filename: string) {
    if (this.chunksBuffer[filename]) {
      const totalChunks = this.chunksBuffer[filename].length;
      delete this.chunksBuffer[filename];
      delete this.transferProgress[filename];
      delete this.lastChunkProcessed[filename];
      
      this.updateProgress(
        filename,
        0,
        totalChunks,
        0,
        0,
        'canceled_by_sender'
      );
    }
  }

  isTransferActive(filename: string): boolean {
    return this.activeTransfers.has(filename);
  }

  handlePause() {
    console.log('[TRANSFER-MANAGER] Transfer manager paused');
    this.isPaused = true;
    
    // Update status of all active transfers
    for (const filename of this.activeTransfers) {
      const progress = this.transferProgress[filename];
      if (progress) {
        this.updateProgress(
          filename,
          progress.currentChunk,
          progress.totalChunks,
          progress.loaded,
          progress.total,
          'paused'
        );
      }
    }
  }

  handleResume() {
    console.log('[TRANSFER-MANAGER] Transfer manager resumed');
    this.isPaused = false;
    
    // Update status of all active transfers
    for (const filename of this.activeTransfers) {
      const progress = this.transferProgress[filename];
      if (progress) {
        this.updateProgress(
          filename,
          progress.currentChunk,
          progress.totalChunks,
          progress.loaded,
          progress.total,
          'transferring'
        );
      }
    }
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
    if (!this.chunksBuffer[filename]) {
      console.log(`[TRANSFER-MANAGER] Starting new transfer for ${filename}`);
      this.chunksBuffer[filename] = [];
      this.activeTransfers.add(filename);
      
      // Initialize progress for new transfer
      this.updateProgress(
        filename,
        0,
        totalChunks,
        0,
        fileSize,
        'transferring'
      );
    }

    try {
      // Skip processing if paused
      if (this.isPaused) {
        console.log('[TRANSFER-MANAGER] Skipping chunk processing while paused');
        return null;
      }

      const decryptedChunk = await this.chunkProcessor.decryptChunk(chunk);
      this.chunksBuffer[filename][chunkIndex] = decryptedChunk;

      const received = this.chunksBuffer[filename].filter(Boolean).length;
      const chunkSize = fileSize / totalChunks;
      const estimatedLoaded = Math.min(received * chunkSize, fileSize);
      
      // Track that we processed this chunk
      this.lastChunkProcessed[filename] = chunkIndex;
      
      // Always update progress for EVERY chunk processed
      this.updateProgress(
        filename,
        received,
        totalChunks,
        estimatedLoaded,
        fileSize,
        'transferring'
      );

      // Check if transfer is complete
      if (received === totalChunks) {
        console.log(`[TRANSFER-MANAGER] Transfer complete for ${filename}`);
        // Final progress update showing 100%
        this.updateProgress(
          filename,
          totalChunks,
          totalChunks,
          fileSize,
          fileSize,
          'transferring'
        );
        
        const completeFile = new Blob(this.chunksBuffer[filename]);
        this.activeTransfers.delete(filename);
        delete this.chunksBuffer[filename];
        delete this.transferProgress[filename];
        delete this.lastChunkProcessed[filename];
        return completeFile;
      }
    } catch (error) {
      console.error(`[TRANSFER-MANAGER] Error processing chunk for ${filename}:`, error);
      this.activeTransfers.delete(filename);
      delete this.chunksBuffer[filename];
      delete this.transferProgress[filename];
      delete this.lastChunkProcessed[filename];
      throw error;
    }

    return null;
  }
}
