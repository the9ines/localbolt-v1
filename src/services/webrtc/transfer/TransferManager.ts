
import type { TransferProgress, FileChunkMessage } from '../types/transfer';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferStateService } from './services/TransferStateService';
import { ProgressEmitter } from './ProgressEmitter';
import { TransferError } from '@/types/webrtc-errors';

export class TransferManager {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private stateService: TransferStateService;

  constructor(
    private dataChannel: RTCDataChannel,
    private chunkProcessor: ChunkProcessor,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    const progressEmitter = new ProgressEmitter(onProgress);
    this.stateService = new TransferStateService(progressEmitter);
  }

  getCurrentProgress(filename: string): TransferProgress {
    return this.stateService.getProgress(filename);
  }

  cancelTransfer(filename: string, isReceiver: boolean) {
    this.stateService.removeTransfer(filename);
    
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
      
      this.stateService.updateProgress(
        filename,
        0,
        0,
        0,
        totalChunks,
        'canceled_by_sender'
      );
      this.stateService.removeTransfer(filename);
    }
  }

  isTransferActive(filename: string): boolean {
    return this.stateService.isTransferActive(filename);
  }

  handlePause() {
    console.log('[TRANSFER] Transfer manager paused');
    this.stateService.updateState({ isPaused: true });
  }

  handleResume() {
    console.log('[TRANSFER] Transfer manager resumed');
    this.stateService.updateState({ isPaused: false });
  }

  isPauseActive() {
    return this.stateService.isPaused();
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
      this.stateService.startTransfer(filename, fileSize);
    }

    try {
      if (this.stateService.isPaused()) {
        console.log('[TRANSFER] Skipping chunk processing while paused');
        return null;
      }

      const decryptedChunk = await this.chunkProcessor.decryptChunk(chunk);
      this.chunksBuffer[filename][chunkIndex] = decryptedChunk;

      const received = this.chunksBuffer[filename].filter(Boolean).length;
      
      this.stateService.updateProgress(
        filename,
        received * (fileSize / totalChunks),
        fileSize,
        received,
        totalChunks
      );

      if (received === totalChunks) {
        const completeFile = new Blob(this.chunksBuffer[filename]);
        this.stateService.removeTransfer(filename);
        delete this.chunksBuffer[filename];
        return completeFile;
      }
    } catch (error) {
      this.stateService.removeTransfer(filename);
      delete this.chunksBuffer[filename];
      throw error;
    }

    return null;
  }
}
