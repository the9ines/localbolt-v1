
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
    console.log(`[TRANSFER] Initiating pause for ${filename}`);
    
    // First update local state
    this.stateManager.handlePause({ filename });
    this.transferManager.handlePause();

    // Then send pause message to peer
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      paused: true
    };
    
    try {
      // Send pause control message before state updates
      this.dataChannel.send(JSON.stringify(message));
      
      // Get current progress to preserve it
      const currentTransfer = this.stateManager.getCurrentTransfer();
      if (currentTransfer?.progress && this.onProgress) {
        this.onProgress({
          ...currentTransfer.progress,
          filename,
          status: 'paused'
        });
      }
      
      console.log('[TRANSFER] Pause initiated successfully');
    } catch (error) {
      console.error('[TRANSFER] Error during pause:', error);
      // Reset state if message sending fails
      this.stateManager.reset();
    }
  }

  resumeTransfer(filename: string) {
    console.log(`[TRANSFER] Initiating resume for ${filename}`);
    
    // First update local state
    this.stateManager.handleResume({ filename });
    this.transferManager.handleResume();

    // Then send resume message to peer
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      resumed: true
    };
    
    try {
      // Send resume control message before state updates
      this.dataChannel.send(JSON.stringify(message));
      
      // Get current progress to preserve it
      const currentTransfer = this.stateManager.getCurrentTransfer();
      if (currentTransfer?.progress && this.onProgress) {
        this.onProgress({
          ...currentTransfer.progress,
          filename,
          status: 'transferring'
        });
      }
      
      console.log('[TRANSFER] Resume initiated successfully');
    } catch (error) {
      console.error('[TRANSFER] Error during resume:', error);
      // Reset state if message sending fails
      this.stateManager.reset();
    }
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
