import { TransferError } from '@/types/webrtc-errors';
import { EncryptionService } from './EncryptionService';
import { ChunkProcessor } from './transfer/ChunkProcessor';
import { TransferManager } from './transfer/TransferManager';
import type { TransferProgress } from './types/transfer';

export type { TransferProgress };

export class FileTransferService {
  private cancelTransfer: boolean = false;
  private transferManager: TransferManager;
  private chunkProcessor: ChunkProcessor;
  private readonly maxRetries: number = 3;
  private readonly initialRetryDelay: number = 1000;
  private readonly maxRetryDelay: number = 5000;
  
  constructor(
    private dataChannel: RTCDataChannel,
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.chunkProcessor = new ChunkProcessor(encryptionService);
    this.transferManager = new TransferManager(dataChannel, this.chunkProcessor, onProgress);
    this.setupDataChannel();
  }

  private setupDataChannel() {
    this.dataChannel.onmessage = async (event) => {
      try {
        const { type, filename, chunk, chunkIndex, totalChunks, fileSize, cancelled, cancelledBy } = JSON.parse(event.data);

        if (type === 'file-chunk') {
          if (cancelled) {
            console.log(`[TRANSFER] Transfer cancelled for ${filename} by ${cancelledBy}`);
            this.cancelTransfer = true;
            this.transferManager.handleCleanup(filename);
            
            if (this.onProgress) {
              this.onProgress({
                filename,
                currentChunk: 0,
                totalChunks: 0,
                loaded: 0,
                total: 0,
                status: cancelledBy === 'receiver' ? 'canceled_by_receiver' : 'canceled_by_sender'
              });
            }
            return;
          }

          if (!this.transferManager.isTransferActive(filename) && chunkIndex !== 0) {
            console.log(`[TRANSFER] Ignoring chunk for cancelled transfer: ${filename}`);
            return;
          }

          console.log(`[TRANSFER] Receiving chunk ${chunkIndex + 1}/${totalChunks} for ${filename}`);
          
          const completeFile = await this.transferManager.processReceivedChunk(
            filename,
            chunk,
            chunkIndex,
            totalChunks,
            fileSize
          );

          if (completeFile) {
            console.log(`[TRANSFER] Completed transfer of ${filename}`);
            this.onReceiveFile(completeFile, filename);
          }
        }
      } catch (error) {
        console.error('[TRANSFER] Error processing message:', error);
        throw new TransferError(
          "Failed to process received data", 
          TransferError.Codes.CHUNK_PROCESSING,
          error
        );
      }
    };
  }

  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.initialRetryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, this.maxRetryDelay);
  }

  private async retryChunk(
    file: File,
    chunkIndex: number,
    totalChunks: number,
    retryCount: number
  ): Promise<boolean> {
    if (retryCount >= this.maxRetries) {
      throw new TransferError(
        `Failed to send chunk after ${this.maxRetries} attempts`,
        TransferError.Codes.CHUNK_PROCESSING
      );
    }

    const delay = this.calculateRetryDelay(retryCount);
    console.log(`[TRANSFER] Retrying chunk ${chunkIndex + 1}/${totalChunks} in ${delay}ms, attempt: ${retryCount + 1}`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    if (this.cancelTransfer) {
      throw new TransferError(
        "Transfer cancelled during retry",
        TransferError.Codes.CANCELED
      );
    }

    try {
      const start = chunkIndex * 16384;
      const end = Math.min(start + 16384, file.size);
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();
      const chunkArray = new Uint8Array(arrayBuffer);
      const base64 = await this.chunkProcessor.encryptChunk(chunkArray);

      const message = JSON.stringify({
        type: 'file-chunk',
        filename: file.name,
        chunk: base64,
        chunkIndex,
        totalChunks,
        fileSize: file.size,
        retryCount: retryCount + 1,
        timestamp: Date.now()
      });

      this.dataChannel.send(message);
      return true;
    } catch (error) {
      console.error(`[TRANSFER] Retry failed for chunk ${chunkIndex + 1}/${totalChunks}:`, error);
      return false;
    }
  }

  cancelCurrentTransfer(filename: string, isReceiver: boolean = false) {
    console.log(`[TRANSFER] Cancelling transfer of ${filename} by ${isReceiver ? 'receiver' : 'sender'}`);
    this.cancelTransfer = true;
    this.transferManager.cancelTransfer(filename, isReceiver);
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    this.cancelTransfer = false;

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (this.cancelTransfer) {
          console.log(`[TRANSFER] Transfer cancelled at chunk ${i + 1}/${totalChunks}`);
          throw new TransferError(
            "Transfer cancelled by user",
            TransferError.Codes.CANCELED
          );
        }

        let retryCount = 0;
        let success = false;

        do {
          try {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            const arrayBuffer = await chunk.arrayBuffer();
            const chunkArray = new Uint8Array(arrayBuffer);
            const base64 = await this.chunkProcessor.encryptChunk(chunkArray);

            const message = JSON.stringify({
              type: 'file-chunk',
              filename: file.name,
              chunk: base64,
              chunkIndex: i,
              totalChunks,
              fileSize: file.size,
              retryCount,
              timestamp: Date.now()
            });

            if (this.dataChannel.bufferedAmount > this.dataChannel.bufferedAmountLowThreshold) {
              console.log('[TRANSFER] Waiting for buffer to clear');
              await new Promise(resolve => {
                this.dataChannel.onbufferedamountlow = () => {
                  this.dataChannel.onbufferedamountlow = null;
                  resolve(null);
                };
              });
            }

            this.dataChannel.send(message);
            success = true;

            if (this.onProgress) {
              this.onProgress({
                filename: file.name,
                currentChunk: i + 1,
                totalChunks,
                loaded: end,
                total: file.size,
                status: retryCount > 0 ? 'retrying' : 'transferring',
                stats: {
                  speed: 0,
                  averageSpeed: 0,
                  startTime: Date.now(),
                  estimatedTimeRemaining: 0,
                  pauseDuration: 0,
                  retryCount,
                  maxRetries: this.maxRetries,
                  lastRetryAt: retryCount > 0 ? Date.now() : undefined
                }
              });
            }

          } catch (error) {
            console.error(`[TRANSFER] Error sending chunk ${i + 1}/${totalChunks}:`, error);
            retryCount++;

            if (retryCount <= this.maxRetries) {
              success = await this.retryChunk(file, i, totalChunks, retryCount);
            } else {
              throw new TransferError(
                `Failed to send chunk after ${this.maxRetries} attempts`,
                TransferError.Codes.CHUNK_PROCESSING,
                { chunkIndex: i, totalChunks, error }
              );
            }
          }
        } while (!success && retryCount <= this.maxRetries);
      }
      
      console.log(`[TRANSFER] Completed sending ${file.name}`);
    } catch (error) {
      console.error('[TRANSFER] Error sending file:', error);
      throw error instanceof Error ? error : new TransferError(
        "Failed to send file",
        TransferError.Codes.CHUNK_PROCESSING,
        error
      );
    }
  }
}
