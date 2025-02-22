
import type { TransferProgress, FileChunkMessage } from '../types/transfer';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferError } from '@/types/webrtc-errors';

export class TransferManager {
  private readonly chunksBuffer: Record<string, Blob[]> = {};
  private readonly activeTransfers: Set<string> = new Set();
  private readonly transferProgress: Record<string, TransferProgress> = {};
  private isPaused = false;

  constructor(
    private readonly dataChannel: RTCDataChannel,
    private readonly chunkProcessor: ChunkProcessor,
    private readonly onProgress?: (progress: TransferProgress) => void
  ) {}

  getCurrentProgress(filename: string): TransferProgress {
    return this.transferProgress[filename] || {
      filename,
      currentChunk: 0,
      totalChunks: 0,
      loaded: 0,
      total: 0,
      status: 'transferring'
    };
  }

  private updateProgress(
    filename: string,
    currentChunk: number,
    totalChunks: number,
    loaded: number,
    total: number,
    status: TransferProgress['status'] = 'transferring'
  ): void {
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

  cancelTransfer(filename: string, isReceiver: boolean): void {
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

  handleCleanup(filename: string): void {
    const progress = this.transferProgress[filename];
    if (!progress) return;

    const totalChunks = this.chunksBuffer[filename]?.length ?? 0;
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

  isTransferActive(filename: string): boolean {
    return this.activeTransfers.has(filename);
  }

  handlePause(): void {
    console.log('[TRANSFER] Transfer manager paused');
    this.isPaused = true;
  }

  handleResume(): void {
    console.log('[TRANSFER] Transfer manager resumed');
    this.isPaused = false;
  }

  isPauseActive(): boolean {
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
      this.chunksBuffer[filename] = [];
      this.activeTransfers.add(filename);
    }

    try {
      if (this.isPaused) {
        console.log('[TRANSFER] Skipping chunk processing while paused');
        return null;
      }

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

      return null;
    } catch (error) {
      this.activeTransfers.delete(filename);
      delete this.chunksBuffer[filename];
      delete this.transferProgress[filename];
      throw error instanceof TransferError ? error : new TransferError('Failed to process chunk', error);
    }
  }
}
