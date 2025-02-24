import { TransferError } from '@/types/webrtc-errors';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferStateManager } from './TransferStateManager';
import { RetryHandler } from './handlers/RetryHandler';
import type { FileChunkMessage } from '../types/transfer';

export class SendFileService {
  private retryHandler: RetryHandler;

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
    const CHUNK_SIZE = 16384;
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    
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
        totalChunks: Math.ceil(file.size / CHUNK_SIZE),
        fileSize: file.size
      };

      if (this.dataChannel.bufferedAmount > this.dataChannel.bufferedAmountLowThreshold) {
        await new Promise(resolve => {
          const handler = () => {
            this.dataChannel.onbufferedamountlow = null;
            resolve(null);
          };
          this.dataChannel.onbufferedamountlow = handler;
        });
      }

      this.dataChannel.send(JSON.stringify(message));
      console.log(`[TRANSFER] Sent chunk ${chunkIndex + 1} for ${file.name}`);
    } catch (error) {
      console.error(`[TRANSFER] Error processing chunk ${chunkIndex}:`, error);
      throw error;
    }
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    this.stateManager.startTransfer(file.name, file.size);

    try {
      for (let i = 0; i < totalChunks; i++) {
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

        try {
          await this.processChunk(file, i);
          
          // Update progress
          const loaded = Math.min((i + 1) * CHUNK_SIZE, file.size);
          this.stateManager.updateTransferProgress(
            file.name,
            loaded,
            file.size,
            i + 1,
            totalChunks
          );
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
      
      console.log(`[TRANSFER] Completed sending ${file.name}`);
    } catch (error) {
      console.error('[TRANSFER] Error sending file:', error);
      throw error instanceof Error ? error : new TransferError("Failed to send file", error);
    } finally {
      this.retryHandler.reset();
      this.stateManager.reset();
    }
  }
}
