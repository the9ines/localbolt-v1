
import type { FileChunkMessage } from '../types/transfer';
import { TransferError } from '@/types/webrtc-errors';
import { TransferManager } from './TransferManager';
import { TransferStateManager } from './TransferStateManager';

export class DataChannelMessageHandler {
  private processingMessages: boolean = false;

  constructor(
    private transferManager: TransferManager,
    private stateManager: TransferStateManager,
    private onReceiveFile: (file: Blob, filename: string) => void
  ) {}

  async handleMessage(event: MessageEvent) {
    if (this.processingMessages) {
      console.log('[TRANSFER] Already processing a message, queuing...');
      setTimeout(() => this.handleMessage(event), 10);
      return;
    }

    this.processingMessages = true;

    try {
      const jsonString = event.data;
      let message: FileChunkMessage;
      
      try {
        message = JSON.parse(jsonString);
      } catch (error) {
        console.error('[TRANSFER] Failed to parse message:', error);
        this.processingMessages = false;
        return;
      }
      
      const { type, filename, chunk, chunkIndex, totalChunks, fileSize, cancelled, cancelledBy, paused, resumed, sessionId } = message;

      if (!type || type !== 'file-chunk' || !filename) {
        console.warn('[TRANSFER] Invalid message format:', message);
        this.processingMessages = false;
        return;
      }

      // Handle control messages first (they are high priority)
      if (cancelled) {
        console.log(`[TRANSFER] Processing cancel message for ${filename} by ${cancelledBy}`);
        const isReceiver = cancelledBy === 'receiver';
        await this.handleCancelMessage(filename, isReceiver);
        this.processingMessages = false;
        return;
      }

      if (paused) {
        console.log(`[TRANSFER] Processing pause message for ${filename}`);
        const success = this.handlePauseMessage(filename, sessionId);
        this.processingMessages = false;
        return;
      }

      if (resumed) {
        console.log(`[TRANSFER] Processing resume message for ${filename}`);
        const success = this.handleResumeMessage(filename, sessionId);
        this.processingMessages = false;
        return;
      }

      // Handle file chunks - check if we should process this chunk
      if (!this.shouldProcessChunk(filename, chunkIndex || 0, sessionId)) {
        console.log(`[TRANSFER] Skipping chunk processing for ${filename} (chunk ${chunkIndex})`);
        this.processingMessages = false;
        return;
      }

      await this.processChunk(filename, chunk, chunkIndex, totalChunks, fileSize);
    } catch (error) {
      console.error('[TRANSFER] Error processing message:', error);
      this.handleTransferError(error);
    } finally {
      this.processingMessages = false;
    }
  }

  private handleTransferError(error: any) {
    console.error('[TRANSFER] Transfer error occurred:', error);
    const currentTransfer = this.stateManager.getCurrentTransfer();
    
    if (currentTransfer?.filename) {
      console.log(`[TRANSFER] Cancelling transfer due to error: ${currentTransfer.filename}`);
      this.transferManager.cancelTransfer(currentTransfer.filename, true);
      this.stateManager.handleError();
    }
  }

  private handlePauseMessage(filename: string, sessionId?: string): boolean {
    console.log(`[TRANSFER] Processing pause message for ${filename}`);
    const pauseSuccess = this.stateManager.handlePause({ filename, sessionId });
    
    if (pauseSuccess) {
      this.transferManager.handlePause();
      console.log('[TRANSFER] Pause state updated successfully');
    } else {
      console.log('[TRANSFER] Failed to update pause state');
    }
    
    return pauseSuccess;
  }

  private handleResumeMessage(filename: string, sessionId?: string): boolean {
    console.log(`[TRANSFER] Processing resume message for ${filename}`);
    const resumeSuccess = this.stateManager.handleResume({ filename, sessionId });
    
    if (resumeSuccess) {
      this.transferManager.handleResume();
      console.log('[TRANSFER] Resume state updated successfully');
    } else {
      console.log('[TRANSFER] Failed to update resume state');
    }
    
    return resumeSuccess;
  }

  private async handleCancelMessage(filename: string, isReceiver: boolean): Promise<void> {
    console.log(`[TRANSFER] Processing cancel message for ${filename}`);
    this.stateManager.handleCancel({ filename, isReceiver });
    this.transferManager.