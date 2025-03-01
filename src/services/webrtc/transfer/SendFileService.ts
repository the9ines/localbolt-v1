
import { TransferError } from '@/types/webrtc-errors';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferStateManager } from './TransferStateManager';
import { RetryHandler } from './handlers/RetryHandler';
import type { FileChunkMessage } from '../types/transfer';

export class SendFileService {
  private retryHandler: RetryHandler;
  private readonly CHUNK_SIZE = 16384;

  constructor(
    private dataChannel: RTCDataChannel,
    private chunkProcessor: ChunkProcessor,
    private stateManager: TransferStateManager
  ) {
    this.retryHandler = new RetryHandler(
      this.retryChunk.bind(this),
      this.handleError.bind(this),
      this.stateManager.updateProgress.bind(this.stateManager)
    );
    console.log('[TRANSFER] Initialized SendFileService with RetryHandler');
  }

  private handleError(error: TransferError): void {
    console.error('[TRANSFER] Error in transfer:', error);
    this.stateManager.reset();
  }

  private async retryChunk(chunkIndex: number, filename: string): Promise<void> {
    const transfer = this.stateManager.getCurrentTransfer();
    if (!transfer || transfer.filename !== filename) {
      throw new TransferError('No active transfer for retry');
    }

    console.log(`[TRANSFER] Retrying chunk ${chunkIndex} for ${filename}`);
    await this.processChunk(transfer.file, chunkIndex);
  }

  private async processChunk(file: File, chunkIndex: number): Promise<void> {
    const start = chunkIndex * this.CHUNK_SIZE;
    const end = Math.min(start + this.CHUNK_SIZE, file.size);
    
    try {
      console.log(`[TRANSFER] Processing chunk ${chunkIndex + 1} for ${file.name}`);
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();
      const chunkArray = new Uint8Array(arrayBuffer);
      const base64 = await this.chunkProcessor.encryptChunk(chunkArray);

      const message: FileChunkMessage = {
        type: 'file-chunk',
        filename: file.name,
        chunk: base64,
        chunkIndex: chunkIndex,
        totalChunks: Math.ceil(file.size / this.CHUNK_SIZE),
        fileSize: file.size
      };

      if (this.dataChannel.bufferedAmount > this.dataChannel.bufferedAmountLowThreshold) {
        await new Promise<void>(resolve => {
          const handler = () => {
            this.dataChannel.onbufferedamountlow = null;
            resolve();
          };
          this.dataChannel.onbufferedamountlow = handler;
        });
      }

      this.dataChannel.send(JSON.stringify(message));
      console.log(`[TRANSFER] Sent chunk ${chunkIndex + 1} for ${file.name}`);
    } catch (error) {
      console.error(`[TRANSFER] Error processing chunk ${chunkIndex}:`, error);
      throw new TransferError(`Failed to process chunk ${chunkIndex}`, error);
    }
  }

  private async checkCancellationAndPause(i: number, totalChunks: number): Promise<void> {
    if (this.stateManager.isCancelled()) {
      console.log(`[TRANSFER] Transfer cancelled at chunk ${i + 1}/${totalChunks}`);
      throw new TransferError("Transfer cancelled by user");
    }

    while (this.stateManager.isPaused()) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.stateManager.isCancelled()) {
        throw new TransferError("Transfer cancelled while paused");
      }
    }
  }

  private updateTransferProgress(file: File, chunkIndex: number, totalChunks: number): void {
    const loaded = Math.min((chunkIndex + 1) * this.CHUNK_SIZE, file.size);
    
    this.stateManager.updateTransferProgress(
      file.name,
      loaded,
      file.size,
      chunkIndex + 1,
      totalChunks
    );
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
    
    this.stateManager.startTransfer(file.name, file.size);

    try {
      await this.processSendingAllChunks(file, totalChunks);
      console.log(`[TRANSFER] Completed sending ${file.name}`);
    } catch (error) {
      console.error('[TRANSFER] Error sending file:', error);
      throw error instanceof Error ? error : new TransferError("Failed to send file", error);
    } finally {
      this.retryHandler.reset();
      this.stateManager.reset();
    }
  }

  private async processSendingAllChunks(file: File, totalChunks: number): Promise<void> {
    for (let i = 0; i < totalChunks; i++) {
      await this.checkCancellationAndPause(i, totalChunks);

      try {
        await this.processChunk(file, i);
        this.updateTransferProgress(file, i, totalChunks);
      } catch (error) {
        console.log(`[TRANSFER] Chunk ${i + 1} failed, attempting retry`);
        const retrySuccess = await this.retryHandler.handleFailedChunk(i, file.name, error as Error);
        
        if (!retrySuccess) {
          throw new TransferError(
            "Failed to send file chunk after retries",
            { chunkIndex: i, totalChunks, error }
          );
        }
      }
    }
  }
}
