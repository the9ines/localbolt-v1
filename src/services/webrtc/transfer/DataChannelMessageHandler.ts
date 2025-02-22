
import type { FileChunkMessage } from '../types/transfer';
import { TransferError } from '@/types/webrtc-errors';
import { TransferManager } from './TransferManager';
import { TransferStateManager } from './TransferStateManager';

export class DataChannelMessageHandler {
  constructor(
    private transferManager: TransferManager,
    private stateManager: TransferStateManager,
    private onReceiveFile: (file: Blob, filename: string) => void
  ) {}

  async handleMessage(event: MessageEvent) {
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
        this.stateManager.handleCancel({ filename, isReceiver: cancelledBy === 'receiver' });
        this.transferManager.cancelTransfer(filename, cancelledBy === 'receiver');
        return;
      }

      if (paused) {
        console.log(`[TRANSFER] Transfer paused for ${filename}`);
        this.stateManager.handlePause({ filename });
        this.transferManager.handlePause();
        return;
      }

      if (resumed) {
        console.log(`[TRANSFER] Transfer resumed for ${filename}`);
        this.stateManager.handleResume({ filename });
        this.transferManager.handleResume();
        return;
      }

      // Handle file chunks only if not paused
      if (!this.transferManager.isPauseActive()) {
        await this.processChunk(filename, chunk, chunkIndex, totalChunks, fileSize);
      } else {
        console.log('[TRANSFER] Skipping chunk processing while paused');
      }

    } catch (error) {
      console.error('[TRANSFER] Error processing message:', error);
      this.stateManager.reset();
      throw new TransferError("Failed to process received data", error);
    }
  }

  private shouldProcessChunk(filename: string, chunkIndex: number): boolean {
    if (!this.transferManager.isTransferActive(filename) && chunkIndex !== 0) {
      console.log(`[TRANSFER] Ignoring chunk for inactive transfer: ${filename}`);
      return false;
    }

    if (this.transferManager.isPauseActive()) {
      console.log(`[TRANSFER] Ignoring chunk while paused: ${filename}`);
      return false;
    }

    return true;
  }

  private async processChunk(
    filename: string,
    chunk: string | undefined,
    chunkIndex: number | undefined,
    totalChunks: number | undefined,
    fileSize: number | undefined
  ) {
    if (!this.shouldProcessChunk(filename, chunkIndex || 0)) {
      return;
    }

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
        this.stateManager.reset();
        this.onReceiveFile(completeFile, filename);
      }
    }
  }
}
