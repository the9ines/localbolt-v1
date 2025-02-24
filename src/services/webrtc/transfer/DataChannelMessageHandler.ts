
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
      console.log('[TRANSFER] Received message:', event.data);
      const message: FileChunkMessage = JSON.parse(event.data);
      const { type, filename, chunk, chunkIndex, totalChunks, fileSize, cancelled, cancelledBy, paused, resumed } = message;

      if (!type || type !== 'file-chunk' || !filename) {
        console.warn('[TRANSFER] Invalid message format:', message);
        return;
      }

      // Handle control messages first
      if (paused) {
        console.log(`[TRANSFER] Processing pause message for ${filename}`);
        const success = this.handlePauseMessage(filename);
        if (!success) {
          console.log('[TRANSFER] Failed to process pause message');
        }
        return;
      }

      if (resumed) {
        console.log(`[TRANSFER] Processing resume message for ${filename}`);
        const success = this.handleResumeMessage(filename);
        if (!success) {
          console.log('[TRANSFER] Failed to process resume message');
        }
        return;
      }

      if (cancelled) {
        console.log(`[TRANSFER] Processing cancel message for ${filename} by ${cancelledBy}`);
        const isReceiver = cancelledBy === 'receiver';
        this.handleCancelMessage(filename, isReceiver);
        return;
      }

      // Handle file chunks
      if (!this.shouldProcessChunk(filename, chunkIndex || 0)) {
        return;
      }

      await this.processChunk(filename, chunk, chunkIndex, totalChunks, fileSize);

    } catch (error) {
      console.error('[TRANSFER] Error processing message:', error);
      this.handleTransferError(error);
    }
  }

  private handleTransferError(error: any) {
    console.error('[TRANSFER] Transfer error occurred:', error);
    if (this.stateManager.getCurrentTransfer()?.filename) {
      const filename = this.stateManager.getCurrentTransfer()?.filename;
      this.transferManager.cancelTransfer(filename, true);
    }
  }

  private handlePauseMessage(filename: string): boolean {
    const pauseSuccess = this.stateManager.handlePause({ filename });
    if (pauseSuccess) {
      this.transferManager.handlePause();
      console.log('[TRANSFER] Pause state updated successfully');
    }
    return pauseSuccess;
  }

  private handleResumeMessage(filename: string): boolean {
    const resumeSuccess = this.stateManager.handleResume({ filename });
    if (resumeSuccess) {
      this.transferManager.handleResume();
      console.log('[TRANSFER] Resume state updated successfully');
    }
    return resumeSuccess;
  }

  private handleCancelMessage(filename: string, isReceiver: boolean): void {
    this.stateManager.handleCancel({ filename, isReceiver });
    this.transferManager.cancelTransfer(filename, isReceiver);
  }

  private shouldProcessChunk(filename: string, chunkIndex: number): boolean {
    const isActive = this.transferManager.isTransferActive(filename);
    const isPaused = this.transferManager.isPauseActive();
    
    console.log(`[TRANSFER] Chunk processing check - filename: ${filename}, active: ${isActive}, paused: ${isPaused}`);
    
    if (!isActive && chunkIndex !== 0) {
      console.log(`[TRANSFER] Ignoring chunk for inactive transfer: ${filename}`);
      return false;
    }

    if (isPaused) {
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
    if (!chunk || typeof chunkIndex !== 'number' || !totalChunks || !fileSize) {
      console.warn('[TRANSFER] Invalid chunk data received');
      return;
    }

    console.log(`[TRANSFER] Processing chunk ${chunkIndex + 1}/${totalChunks} for ${filename}`);
    
    try {
      const completeFile = await this.transferManager.processReceivedChunk(
        filename,
        chunk,
        chunkIndex,
        totalChunks,
        fileSize
      );

      if (completeFile) {
        console.log(`[TRANSFER] Completed transfer of ${filename}`);
        
        // Create a promise to handle file saving
        const saveFilePromise = new Promise<void>((resolve) => {
          try {
            this.onReceiveFile(completeFile, filename);
            resolve();
          } catch (error) {
            console.error('[TRANSFER] Error saving file:', error);
            resolve(); // Resolve anyway to ensure cleanup
          }
        });

        // Wait for file saving to complete before state reset
        await saveFilePromise;
        
        console.log(`[TRANSFER] File ${filename} saved successfully, performing cleanup`);
        this.stateManager.reset();
      }
    } catch (error) {
      console.error('[TRANSFER] Error processing chunk:', error);
      this.handleTransferError(error);
    }
  }
}
