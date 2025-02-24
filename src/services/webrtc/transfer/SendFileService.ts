
import { TransferError } from '@/types/webrtc-errors';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferStateManager } from './TransferStateManager';
import { BandwidthAdapter } from './BandwidthAdapter';
import type { FileChunkMessage } from '../types/transfer';
import type { ConnectionQuality, ConnectionQualityMetrics } from '../types/connection-quality';

export class SendFileService {
  private bandwidthAdapter: BandwidthAdapter;

  constructor(
    private dataChannel: RTCDataChannel,
    private chunkProcessor: ChunkProcessor,
    private stateManager: TransferStateManager
  ) {
    this.bandwidthAdapter = new BandwidthAdapter();
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    this.stateManager.startTransfer(file.name, file.size);

    try {
      let position = 0;
      while (position < file.size) {
        if (this.stateManager.isCancelled()) {
          console.log(`[TRANSFER] Transfer cancelled at position ${position}`);
          throw new TransferError("Transfer cancelled by user");
        }

        while (this.stateManager.isPaused()) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (this.stateManager.isCancelled()) {
            throw new TransferError("Transfer cancelled while paused");
          }
        }

        const chunkSize = this.bandwidthAdapter.getCurrentChunkSize();
        const chunk = file.slice(position, position + chunkSize);
        
        try {
          const arrayBuffer = await chunk.arrayBuffer();
          const chunkArray = new Uint8Array(arrayBuffer);
          const base64 = await this.chunkProcessor.encryptChunk(chunkArray);

          const message: FileChunkMessage = {
            type: 'file-chunk',
            filename: file.name,
            chunk: base64,
            chunkIndex: Math.floor(position / chunkSize),
            totalChunks: Math.ceil(file.size / chunkSize),
            fileSize: file.size
          };

          if (this.bandwidthAdapter.shouldThrottle()) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }

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
          position += chunkSize;

          // Update progress
          this.stateManager.updateTransferProgress(
            file.name,
            position,
            file.size,
            Math.floor(position / chunkSize),
            Math.ceil(file.size / chunkSize)
          );

        } catch (error) {
          throw new TransferError(
            "Failed to send file chunk",
            { position, chunkSize, error }
          );
        }
      }
      
      console.log(`[TRANSFER] Completed sending ${file.name}`);
    } catch (error) {
      console.error('[TRANSFER] Error sending file:', error);
      throw error instanceof Error ? error : new TransferError("Failed to send file", error);
    } finally {
      this.stateManager.reset();
      this.bandwidthAdapter.reset();
    }
  }

  updateConnectionQuality(quality: ConnectionQuality, metrics: ConnectionQualityMetrics): void {
    this.bandwidthAdapter.updateQuality(quality, metrics);
  }
}
