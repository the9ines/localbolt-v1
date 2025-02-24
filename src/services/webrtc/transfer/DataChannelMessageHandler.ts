
import { FileChunkMessage } from '../types/transfer';
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferManager } from './TransferManager';
import type { TransferStateManager } from './TransferStateManager';
import type { TransferControlMessage } from '../types/transfer-control';

export class DataChannelMessageHandler {
  constructor(
    private transferManager: TransferManager,
    private stateManager: TransferStateManager,
    private onReceiveFile: (file: Blob, filename: string) => void
  ) {}

  async handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data) as FileChunkMessage;
      
      if (message.type === 'file-chunk') {
        if (message.cancelled) {
          console.log('[TRANSFER] Transfer cancelled by', message.cancelledBy);
          this.stateManager.handleCancel({
            filename: message.filename,
            isReceiver: message.cancelledBy === 'receiver'
          });
          return;
        }

        if (message.paused) {
          console.log('[TRANSFER] Transfer paused for:', message.filename);
          this.stateManager.handlePause({
            filename: message.filename
          });
          return;
        }

        if (message.resumed) {
          console.log('[TRANSFER] Transfer resumed for:', message.filename);
          this.stateManager.handleResume({
            filename: message.filename
          });
          return;
        }

        // Regular chunk processing
        if (message.chunk && message.chunkIndex !== undefined) {
          await this.processFileChunk(message);
        }
      }
    } catch (error) {
      console.error('[TRANSFER] Failed to process message:', error);
      throw new WebRTCError('Failed to process message', error);
    }
  }

  private async processFileChunk(message: FileChunkMessage) {
    try {
      await this.transferManager.processChunk(
        message.filename,
        message.chunk!,
        message.chunkIndex!,
        message.totalChunks || 0,
        message.fileSize || 0
      );

      // If this was the last chunk, trigger file assembly
      if (message.chunkIndex === (message.totalChunks || 0) - 1) {
        const assembledFile = await this.transferManager.assembleFile(message.filename);
        if (assembledFile) {
          this.onReceiveFile(assembledFile, message.filename);
        }
      }
    } catch (error) {
      console.error('[TRANSFER] Failed to process chunk:', error);
      throw new WebRTCError('Failed to process chunk', error);
    }
  }
}
