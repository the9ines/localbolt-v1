
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
  private currentTransfer: { filename: string; total: number } | null = null;
  
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

        if (!type || type !== 'file-chunk' || !filename) {
          console.warn('[TRANSFER] Invalid message format:', message);
          return;
        }

        // Handle control messages first
        if (cancelled) {
          console.log(`[TRANSFER] Transfer cancelled for ${filename} by ${cancelledBy}`);
          this.handleTransferCancellation(filename, cancelledBy === 'receiver');
          return;
        }

        if (paused) {
          console.log(`[TRANSFER] Transfer paused for ${filename}`);
          this.handleTransferPause(filename);
          return;
        }

        if (resumed) {
          console.log(`[TRANSFER] Transfer resumed for ${filename}`);
          this.handleTransferResume(filename);
          return;
        }

        // Ignore chunks if transfer is inactive or paused
        if (!this.transferManager.isTransferActive(filename) && chunkIndex !== 0) {
          console.log(`[TRANSFER] Ignoring chunk for inactive transfer: ${filename}`);
          return;
        }

        if (this.isPaused) {
          console.log(`[TRANSFER] Ignoring chunk while paused: ${filename}`);
          return;
        }

        // Process chunk
        if (chunk && typeof chunkIndex === 'number' && totalChunks && fileSize) {
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
            this.currentTransfer = null;
            this.onReceiveFile(completeFile, filename);
          }
        }
      } catch (error) {
        console.error('[TRANSFER] Error processing message:', error);
        this.currentTransfer = null;
        throw new TransferError("Failed to process received data", error);
      }
    };

    this.dataChannel.onclose = () => {
      console.log('[TRANSFER] Data channel closed, cleaning up transfer state');
      this.cancelTransfer = false;
      this.isPaused = false;
      this.currentTransfer = null;
    };
  }

  private handleTransferCancellation(filename: string, isReceiver: boolean) {
    this.cancelTransfer = true;
    this.isPaused = false;
    this.currentTransfer = null;
    this.transferManager.handleCleanup(filename);
    
    if (this.onProgress) {
      this.onProgress({
        filename,
        currentChunk: 0,
        totalChunks: 0,
        loaded: 0,
        total: 0,
        status: isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender'
      });
    }
  }

  private handleTransferPause(filename: string) {
    if (this.currentTransfer?.filename === filename) {
      this.isPaused = true;
      if (this.onProgress) {
        this.onProgress({
          ...this.transferManager.getCurrentProgress(filename),
          status: 'paused'
        });
      }
    }
  }

  private handleTransferResume(filename: string) {
    if (this.currentTransfer?.filename === filename) {
      this.isPaused = false;
      if (this.onProgress) {
        this.onProgress({
          ...this.transferManager.getCurrentProgress(filename),
          status: 'transferring'
        });
      }
    }
  }

  cancelCurrentTransfer(filename: string, isReceiver: boolean = false) {
    console.log(`[TRANSFER] Cancelling transfer of ${filename} by ${isReceiver ? 'receiver' : 'sender'}`);
    this.handleTransferCancellation(filename, isReceiver);
    this.transferManager.cancelTransfer(filename, isReceiver);
  }

  pauseTransfer(filename: string) {
    if (!this.currentTransfer || this.currentTransfer.filename !== filename) {
      console.warn('[TRANSFER] Cannot pause: no active transfer for', filename);
      return;
    }

    console.log(`[TRANSFER] Pausing transfer of ${filename}`);
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      paused: true
    };
    this.dataChannel.send(JSON.stringify(message));
    this.handleTransferPause(filename);
  }

  resumeTransfer(filename: string) {
    if (!this.currentTransfer || this.currentTransfer.filename !== filename) {
      console.warn('[TRANSFER] Cannot resume: no active transfer for', filename);
      return;
    }

    console.log(`[TRANSFER] Resuming transfer of ${filename}`);
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      resumed: true
    };
    this.dataChannel.send(JSON.stringify(message));
    this.handleTransferResume(filename);
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    this.cancelTransfer = false;
    this.isPaused = false;
    this.currentTransfer = { filename: file.name, total: file.size };

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (this.cancelTransfer) {
          console.log(`[TRANSFER] Transfer cancelled at chunk ${i + 1}/${totalChunks}`);
          this.currentTransfer = null;
          throw new TransferError("Transfer cancelled by user");
        }

        while (this.isPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (this.cancelTransfer) {
            this.currentTransfer = null;
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
              const handler = () => {
                this.dataChannel.onbufferedamountlow = null;
                resolve(null);
              };
              this.dataChannel.onbufferedamountlow = handler;
            });
          }

          if (this.cancelTransfer) {
            console.log(`[TRANSFER] Transfer cancelled during send at chunk ${i + 1}/${totalChunks}`);
            this.currentTransfer = null;
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
          this.currentTransfer = null;
          throw new TransferError(
            "Failed to send file chunk",
            { chunkIndex: i, totalChunks, error }
          );
        }
      }
      console.log(`[TRANSFER] Completed sending ${file.name}`);
      this.currentTransfer = null;
    } catch (error) {
      console.error('[TRANSFER] Error sending file:', error);
      this.currentTransfer = null;
      throw error instanceof Error ? error : new TransferError("Failed to send file", error);
    }
  }
}
