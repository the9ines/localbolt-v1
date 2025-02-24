
import { TransferError } from '@/types/webrtc-errors';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferStateManager } from './TransferStateManager';
import type { FileChunkMessage } from '../types/transfer';

export class SendFileService {
  constructor(
    private dataChannel: RTCDataChannel,
    private chunkProcessor: ChunkProcessor,
    private stateManager: TransferStateManager
  ) {}

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

          // Update progress for sender
          this.stateManager.updateTransferProgress(
            file.name,
            end,  // loaded bytes
            file.size,  // total bytes
            i + 1,  // current chunk
            totalChunks  // total chunks
          );

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
