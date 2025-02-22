
import type { TransferProgress, FileChunkMessage } from '../types/transfer';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferError } from '@/types/webrtc-errors';

export class TransferManager {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private activeTransfers: Set<string> = new Set();
  private chunkProcessor: ChunkProcessor;
  private transferProgress: { [key: string]: TransferProgress } = {};
  private isPaused: boolean = false;

  constructor(
    private dataChannel: RTCDataChannel,
    chunkProcessor: ChunkProcessor,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.chunkProcessor = chunkProcessor;
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
    console.log('[TRANSFER-MANAGER] Updating progress:', {
      filename,
      currentChunk,
      totalChunks,
      loaded,
      total,
      status
    });

    const progress: TransferProgress = {
      filename,
      currentChunk,
      totalChunks,
      loaded,
      total,
      status
    };

    this.transferProgress[filename] = progress;

    if (this.onProgress) {
      console.log('[TRANSFER-MANAGER] Emitting progress update');
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

  handleCleanup(filename: string) {
    if (this.chunksBuffer[filename]) {
      const totalChunks = this.chunksBuffer[filename].length;
      delete this.chunksBuffer[filename];
      delete this.transferProgress[filename];
      
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
    
    // Update progress status for all active transfers
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
    
    // Update progress status for all active transfers
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
      console.log('[TRANSFER-MANAGER] Initializing new transfer:', {
        filename,
        totalChunks,
        fileSize
      });
      this.chunksBuffer[filename] = [];
      this.activeTransfers.add(filename);
    }

    try {
      if (this.isPaused) {
        console.log('[TRANSFER-MANAGER] Skipping chunk processing while paused');
        return null;
      }

      const decryptedChunk = await this.chunkProcessor.decryptChunk(chunk);
      this.chunksBuffer[filename][chunkIndex] = decryptedChunk;

      const received = this.chunksBuffer[filename].filter(Boolean).length;
      const loaded = received * (fileSize / totalChunks);
      
      console.log('[TRANSFER-MANAGER] Chunk processed:', {
        filename,
        chunkIndex,
        received,
        totalChunks,
        loaded,
        fileSize
      });
      
      this.updateProgress(
        filename,
        received,
        totalChunks,
        loaded,
        fileSize
      );

      if (received === totalChunks) {
        console.log('[TRANSFER-MANAGER] Transfer complete:', filename);
        const completeFile = new Blob(this.chunksBuffer[filename]);
        this.activeTransfers.delete(filename);
        delete this.chunksBuffer[filename];
        delete this.transferProgress[filename];
        return completeFile;
      }
    } catch (error) {
      console.error('[TRANSFER-MANAGER] Error processing chunk:', error);
      this.activeTransfers.delete(filename);
      delete this.chunksBuffer[filename];
      delete this.transferProgress[filename];
      throw error;
    }

    return null;
  }
}
