
import type { TransferProgress, FileChunkMessage } from '../types/transfer';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferError } from '@/types/webrtc-errors';

export class TransferManager {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private activeTransfers: Set<string> = new Set();
  private chunkProcessor: ChunkProcessor;
  private transferProgress: { [key: string]: TransferProgress } = {};

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

  async processReceivedChunk(
    filename: string,
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
    fileSize: number
  ): Promise<Blob | null> {
    if (!this.chunksBuffer[filename]) {
      this.chunksBuffer[filename] = [];
      this.activeTransfers.add(filename);
    }

    try {
      const decryptedChunk = await this.chunkProcessor.decryptChunk(chunk);
      this.chunksBuffer[filename][chunkIndex] = decryptedChunk;

      const received = this.chunksBuffer[filename].filter(Boolean).length;
      
      this.updateProgress(
        filename,
        received,
        totalChunks,
        received * (fileSize / totalChunks),
        fileSize
      );

      if (received === totalChunks) {
        const completeFile = new Blob(this.chunksBuffer[filename]);
        this.activeTransfers.delete(filename);
        delete this.chunksBuffer[filename];
        delete this.transferProgress[filename];
        return completeFile;
      }
    } catch (error) {
      this.activeTransfers.delete(filename);
      delete this.chunksBuffer[filename];
      delete this.transferProgress[filename];
      this.updateProgress(filename, 0, totalChunks, 0, fileSize, 'error');
      throw error;
    }

    return null;
  }
}
