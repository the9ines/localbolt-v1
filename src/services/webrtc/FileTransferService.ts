
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
        throw new TransferError("Failed to process received data", error);
      }
    };
  }

  cancelCurrentTransfer(filename: string, isReceiver: boolean = false) {
    console.log(`[TRANSFER] Cancelling transfer of ${filename} by ${isReceiver ? 'receiver' : 'sender'}`);
    this.cancelTransfer = true;
    this.transferManager.cancelTransfer(filename, isReceiver);
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 262144; // Increased to 256KB chunks for better performance
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    this.cancelTransfer = false;

    const startTime = Date.now();
    let lastUpdateTime = startTime;
    let bytesTransferred = 0;
    let totalPauseDuration = 0;
    let lastPausedAt: number | undefined;
    let retryCount = 0;
    const maxRetries = 3;

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (this.cancelTransfer) {
          console.log(`[TRANSFER] Transfer cancelled at chunk ${i + 1}/${totalChunks}`);
          throw new TransferError("Transfer cancelled by user");
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        console.log(`[TRANSFER] Processing chunk ${i + 1}/${totalChunks}`);
        const arrayBuffer = await chunk.arrayBuffer();
        const chunkArray = new Uint8Array(arrayBuffer);
        
        try {
          const base64 = await this.chunkProcessor.encryptChunk(chunkArray);

          const message = JSON.stringify({
            type: 'file-chunk',
            filename: file.name,
            chunk: base64,
            chunkIndex: i,
            totalChunks,
            fileSize: file.size
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

          if (this.cancelTransfer) {
            console.log(`[TRANSFER] Transfer cancelled during send at chunk ${i + 1}/${totalChunks}`);
            throw new TransferError("Transfer cancelled by user");
          }

          this.dataChannel.send(message);
          console.log(`[TRANSFER] Sent chunk ${i + 1}/${totalChunks}`);

          bytesTransferred = end;
          const currentTime = Date.now();
          const elapsedTime = (currentTime - startTime - totalPauseDuration) / 1000; // Convert to seconds
          const currentSpeed = bytesTransferred / elapsedTime;
          const averageSpeed = bytesTransferred / elapsedTime;
          const remainingBytes = file.size - bytesTransferred;
          const estimatedTimeRemaining = remainingBytes / currentSpeed;

          if (this.onProgress) {
            this.onProgress({
              filename: file.name,
              currentChunk: i + 1,
              totalChunks,
              loaded: end,
              total: file.size,
              status: 'transferring',
              stats: {
                speed: currentSpeed,
                averageSpeed,
                startTime,
                estimatedTimeRemaining,
                pauseDuration: totalPauseDuration,
                retryCount,
                maxRetries,
                lastPausedAt
              }
            });
          }
        } catch (error) {
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(`[TRANSFER] Retry ${retryCount}/${maxRetries} for chunk ${i}`);
            i--; // Retry the same chunk
            continue;
          }
          throw new TransferError(
            "Failed to send file chunk",
            { chunkIndex: i, totalChunks, error }
          );
        }
      }
      console.log(`[TRANSFER] Completed sending ${file.name}`);
    } catch (error) {
      console.error('[TRANSFER] Error sending file:', error);
      throw error instanceof Error ? error : new TransferError("Failed to send file", error);
    }
  }
}
