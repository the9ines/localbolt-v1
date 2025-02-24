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
      total: 0,
      sending: false
    };
  }

  getTransfer(filename: string): TransferProgress | undefined {
    return this.transferProgress[filename];
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
      sending: true,
      status
    };

    this.transferProgress[filename] = progress;

    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  async processChunk(
    filename: string,
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
    fileSize: number
  ): Promise<void> {
    if (!this.chunksBuffer[filename]) {
      this.chunksBuffer[filename] = [];
      this.activeTransfers.add(filename);
    }

    if (this.isPaused) {
      console.log('[TRANSFER] Skipping chunk processing while paused');
      return;
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
    } catch (error) {
      this.activeTransfers.delete(filename);
      delete this.chunksBuffer[filename];
      delete this.transferProgress[filename];
      throw error;
    }
  }

  async assembleFile(filename: string): Promise<Blob | null> {
    if (!this.chunksBuffer[filename]) return null;

    const completeFile = new Blob(this.chunksBuffer[filename]);
    this.activeTransfers.delete(filename);
    delete this.chunksBuffer[filename];
    delete this.transferProgress[filename];
    return completeFile;
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
}
