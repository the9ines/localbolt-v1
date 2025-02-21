
import { TransferError } from '@/types/webrtc-errors';
import { EncryptionService } from './EncryptionService';
import { ChunkProcessor } from './transfer/ChunkProcessor';
import { TransferManager } from './transfer/TransferManager';
import type { TransferProgress, FileChunkMessage } from './types/transfer';

export type { TransferProgress };

export class FileTransferService {
  private cancelTransfer: boolean = false;
  private isPaused: boolean = false;
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
        const message: FileChunkMessage = JSON.parse(event.data);
        const { type, filename, chunk, chunkIndex, totalChunks, fileSize, cancelled, cancelledBy, paused, resumed } = message;

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

          if (paused) {
            console.log(`[TRANSFER] Transfer paused for ${filename}`);
            this.isPaused = true;
            if (this.onProgress) {
              this.onProgress({
                ...this.transferManager.getCurrentProgress(filename),
                status: 'paused'
              });
            }
            return;
          }

          if (resumed) {
            console.log(`[TRANSFER] Transfer resumed for ${filename}`);
            this.isPaused = false;
            if (this.onProgress) {
              this.onProgress({
                ...this.transferManager.getCurrentProgress(filename),
                status: 'transferring'
              });
            }
            return;
          }

          if (!this.transferManager.isTransferActive(filename) && chunkIndex !== 0) {
            console.log(`[TRANSFER] Ignoring chunk for cancelled transfer: ${filename}`);
            return;
          }

          if (this.isPaused) {
            console.log(`[TRANSFER] Ignoring chunk while paused: ${filename}`);
            return;
          }

          console.log(`[TRANSFER] Receiving chunk ${chunkIndex + 1}/${totalChunks} for ${filename}`);
          
          const completeFile = await this.transferManager.processReceivedChunk(
            filename,
            chunk!,
            chunkIndex!,
            totalChunks!,
            fileSize!
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

  pauseTransfer(filename: string) {
    console.log(`[TRANSFER] Pausing transfer of ${filename}`);
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      paused: true
    };
    this.dataChannel.send(JSON.stringify(message));
    this.isPaused = true;
  }

  resumeTransfer(filename: string) {
    console.log(`[TRANSFER] Resuming transfer of ${filename}`);
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      resumed: true
    };
    this.dataChannel.send(JSON.stringify(message));
    this.isPaused = false;
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    this.cancelTransfer = false;
    this.isPaused = false;

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (this.cancelTransfer) {
          console.log(`[TRANSFER] Transfer cancelled at chunk ${i + 1}/${totalChunks}`);
          throw new TransferError("Transfer cancelled by user");
        }

        while (this.isPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (this.cancelTransfer) {
            throw new TransferError("Transfer cancelled while paused");
          }
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        console.log(`[TRANSFER] Processing chunk ${i + 1}/${totalChunks}`);
        const arrayBuffer = await chunk.arrayBuffer();
        const chunkArray = new Uint8Array(arrayBuffer);
        
        try {
          const base64 = await this.chunkProcessor.encryptChunk(chunkArray);

          const message: FileChunkMessage = {
            type: 'file-chunk',
            filename: file.name,
            chunk: base64,
            chunkIndex: i,
            totalChunks,
            fileSize: file.size
          };

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

          this.dataChannel.send(JSON.stringify(message));
          console.log(`[TRANSFER] Sent chunk ${i + 1}/${totalChunks}`);

          if (this.onProgress) {
            this.onProgress({
              filename: file.name,
              currentChunk: i + 1,
              totalChunks,
              loaded: end,
              total: file.size,
              status: this.isPaused ? 'paused' : 'transferring'
            });
          }
        } catch (error) {
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
