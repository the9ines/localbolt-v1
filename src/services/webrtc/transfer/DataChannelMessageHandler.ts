
import { TransferManager } from './TransferManager';
import { TransferStateManager } from './TransferStateManager';
import type { FileChunkMessage } from '../types/transfer';
import { TransferError } from '@/types/webrtc-errors';

export class DataChannelMessageHandler {
  constructor(
    private transferManager: TransferManager,
    private stateManager: TransferStateManager,
    private onReceiveFile: (file: Blob, filename: string) => void
  ) {}

  async handleMessage(event: MessageEvent) {
    try {
      // Parse the message data
      const messageData = JSON.parse(event.data);
      
      // Log every message for debugging
      console.log('[MESSAGE-HANDLER] Received message:', {
        type: messageData.type,
        filename: messageData.filename,
        chunkIndex: messageData.chunkIndex,
        totalChunks: messageData.totalChunks,
        hasChunk: !!messageData.chunk,
        cancelled: messageData.cancelled,
      });
      
      if (messageData.type !== 'file-chunk') {
        console.log('[MESSAGE-HANDLER] Ignoring non-file-chunk message');
        return;
      }

      const message = messageData as FileChunkMessage;

      // Handle control messages
      if (message.cancelled) {
        console.log('[MESSAGE-HANDLER] Received cancel message for:', message.filename);
        this.transferManager.handleCleanup(message.filename);
        this.stateManager.handleCancel({
          type: 'cancel',
          filename: message.filename,
          sessionId: message.sessionId
        });
        return;
      }

      if (message.paused) {
        console.log('[MESSAGE-HANDLER] Received pause message for:', message.filename);
        this.transferManager.handlePause();
        this.stateManager.handlePause({
          type: 'pause',
          filename: message.filename,
          sessionId: message.sessionId
        });
        return;
      }

      if (message.resumed) {
        console.log('[MESSAGE-HANDLER] Received resume message for:', message.filename);
        this.transferManager.handleResume();
        this.stateManager.handleResume({
          type: 'resume',
          filename: message.filename,
          sessionId: message.sessionId
        });
        return;
      }

      // Handle chunk messages
      if (message.chunk && message.chunkIndex !== undefined && 
          message.totalChunks !== undefined && message.fileSize !== undefined) {
          
        // Process the received chunk
        const file = await this.transferManager.processReceivedChunk(
          message.filename,
          message.chunk,
          message.chunkIndex,
          message.totalChunks,
          message.fileSize
        );

        // Update progress state
        const loaded = Math.min(
          (message.chunkIndex + 1) * (message.fileSize / message.totalChunks),
          message.fileSize
        );
        
        this.stateManager.updateProgress(
          message.filename,
          loaded,
          message.fileSize,
          message.chunkIndex + 1,
          message.totalChunks
        );

        // If the transfer is complete, notify
        if (file) {
          console.log('[MESSAGE-HANDLER] Transfer complete for:', message.filename);
          this.onReceiveFile(file, message.filename);
        }
      }
    } catch (error) {
      console.error('[MESSAGE-HANDLER] Error handling message:', error);
      throw new TransferError("Error processing file chunk", error);
    }
  }
}
