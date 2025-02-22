import { TransferError } from '@/types/webrtc-errors';
import { EncryptionService } from './EncryptionService';
import { ChunkProcessor } from './transfer/ChunkProcessor';
import { TransferManager } from './transfer/TransferManager';
import { TransferStateManager } from './transfer/TransferStateManager';
import { DataChannelMessageHandler } from './transfer/DataChannelMessageHandler';
import type { TransferProgress, FileChunkMessage } from './types/transfer';

export type { TransferProgress };

export class FileTransferService {
  private transferManager: TransferManager;
  private chunkProcessor: ChunkProcessor;
  private stateManager: TransferStateManager;
  private messageHandler: DataChannelMessageHandler;

  constructor(
    private dataChannel: RTCDataChannel,
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.chunkProcessor = new ChunkProcessor(encryptionService);
    this.transferManager = new TransferManager(dataChannel, this.chunkProcessor, onProgress);
    this.stateManager = new TransferStateManager(onProgress);
    this.messageHandler = new DataChannelMessageHandler(
      this.transferManager,
      this.stateManager,
      onReceiveFile
    );
    this.setupDataChannel();
  }

  private setupDataChannel() {
    this.dataChannel.onmessage = (event) => this.messageHandler.handleMessage(event);
    this.dataChannel.onclose = () => {
      console.log('[TRANSFER] Data channel closed, cleaning up transfer state');
      this.stateManager.reset();
    };
  }

  cancelCurrentTransfer(filename: string, isReceiver: boolean = false) {
    console.log(`[TRANSFER] Cancelling transfer of ${filename}`);
    this.stateManager.handleCancel({ filename, isReceiver });
    this.transferManager.cancelTransfer(filename, isReceiver);
    
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      cancelled: true,
      cancelledBy: isReceiver ? 'receiver' : 'sender'
    };
    this.dataChannel.send(JSON.stringify(message));
  }

  pauseTransfer(filename: string) {
    if (!this.stateManager.getCurrentTransfer()) {
      console.warn('[TRANSFER] Cannot pause: no active transfer');
      return;
    }

    console.log(`[TRANSFER] Pausing transfer of ${filename}`);
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      paused: true
    };
    this.dataChannel.send(JSON.stringify(message));
    this.stateManager.handlePause({ filename });
    this.transferManager.handlePause(); // Add this line to pause the transfer manager
  }

  resumeTransfer(filename: string) {
    if (!this.stateManager.getCurrentTransfer()) {
      console.warn('[TRANSFER] Cannot resume: no active transfer');
      return;
    }

    console.log(`[TRANSFER] Resuming transfer of ${filename}`);
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      resumed: true
    };
    this.dataChannel.send(JSON.stringify(message));
    this.stateManager.handleResume({ filename });
    this.transferManager.handleResume(); // Add this line to resume the transfer manager
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384; // 16KB chunks
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

          if (this.stateManager.isCancelled()) {
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
              status: this.stateManager.isPaused() ? 'paused' : 'transferring'
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
    } finally {
      this.stateManager.reset();
    }
  }
}
