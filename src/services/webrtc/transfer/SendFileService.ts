
import { TransferError } from '@/types/webrtc-errors';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferStateManager } from './TransferStateManager';
import { RetryHandler } from './handlers/RetryHandler';
import type { FileChunkMessage, TransferProgress } from '../types/transfer';
import type { TransferState } from '../types/transfer-control';

export class SendFileService {
  private retryHandler: RetryHandler;
  private activeTransfers: Map<string, { 
    file: File, 
    sessionId: string,
    aborted: boolean 
  }> = new Map();

  constructor(
    private dataChannel: RTCDataChannel,
    private chunkProcessor: ChunkProcessor,
    private stateManager: TransferStateManager,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.retryHandler = new RetryHandler(
      this.retryChunk.bind(this),
      this.handleError.bind(this),
      this.handleProgressUpdate.bind(this)
    );
    console.log('[TRANSFER] Initialized SendFileService with RetryHandler');
  }

  private handleProgressUpdate(progress: TransferProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  private handleError(error: TransferError): void {
    console.error('[TRANSFER] Error in transfer:', error);
    
    // If the error is associated with a specific file, mark that transfer as aborted
    if (error.details && typeof error.details === 'object' && 'filename' in error.details) {
      const filename = error.details.filename as string;
      const transferInfo = this.activeTransfers.get(filename);
      
      if (transferInfo) {
        console.log(`[TRANSFER] Marking transfer as aborted: ${filename}`);
        this.activeTransfers.set(filename, {
          ...transferInfo,
          aborted: true
        });
      }
    }
    
    this.stateManager.resetTransferState('error');
  }

  private async retryChunk(chunkIndex: number, filename: string): Promise<void> {
    const transferInfo = this.activeTransfers.get(filename);
    if (!transferInfo || transferInfo.aborted) {
      throw new TransferError('No active transfer for retry or transfer was aborted');
    }

    console.log(`[TRANSFER] Retrying chunk ${chunkIndex} for ${filename}`);
    await this.processChunk(transferInfo.file, chunkIndex, transferInfo.sessionId);
  }

  private async processChunk(file: File, chunkIndex: number, sessionId: string): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new TransferError('Data channel not open');
    }

    const CHUNK_SIZE = 16384;
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    try {
      // Read the chunk data
      const arrayBuffer = await chunk.arrayBuffer();
      const encryptedChunk = await this.chunkProcessor.encryptChunk(arrayBuffer);
      
      // Prepare the message
      const message: FileChunkMessage = {
        type: 'file-chunk',
        filename: file.name,
        chunk: encryptedChunk,
        chunkIndex,
        totalChunks: Math.ceil(file.size / CHUNK_SIZE),
        fileSize: file.size,
        sessionId
      };
      
      // Send the chunk
      this.dataChannel.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[TRANSFER] Error processing chunk ${chunkIndex}:`, error);
      throw new TransferError(`Failed to process chunk ${chunkIndex}`, { 
        error, 
        chunkIndex, 
        filename: file.name 
      });
    }
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // Generate a unique session ID for this transfer
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Initialize transfer state
    this.stateManager.startTransfer(file.name, file.size);
    
    // Store the file and session ID for retries
    this.activeTransfers.set(file.name, {
      file,
      sessionId,
      aborted: false
    });

    try {
      for (let i = 0; i < totalChunks; i++) {
        // Check if transfer was canceled
        if (this.stateManager.isCancelled() || this.activeTransfers.get(file.name)?.aborted) {
          console.log(`[TRANSFER] Transfer cancelled at chunk ${i + 1}/${totalChunks}`);
          throw new TransferError("Transfer cancelled by user");
        }

        // Handle pause state
        while (this.stateManager.isPaused() && !this.stateManager.isCancelled()) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Re-check canceled status after waiting
          if (this.stateManager.isCancelled() || this.activeTransfers.get(file.name)?.aborted) {
            throw new TransferError("Transfer cancelled while paused");
          }
        }

        try {
          // Process and send the chunk
          await this.processChunk(file, i, sessionId);
          
          // Update progress
          const loaded = Math.min((i + 1) * CHUNK_SIZE, file.size);
          this.stateManager.updateProgress(
            file.name,
            loaded,
            file.size,
            i + 1,
            totalChunks
          );
        } catch (error) {
          console.log(`[TRANSFER] Chunk ${i + 1} failed, attempting retry`);
          const retrySuccess = await this.retryHandler.handleFailedChunk(i, file.name, error as Error);
          
          if (!retrySuccess) {
            throw new TransferError(
              "Failed to send file chunk after retries",
              { chunkIndex: i, totalChunks, error }
            );
          }
        }
      }
      
      console.log(`[TRANSFER] Completed sending ${file.name}`);
      
      // Clean up the active transfer
      this.activeTransfers.delete(file.name);
    } catch (error) {
      console.error('[TRANSFER] Error sending file:', error);
      
      // Clean up the active transfer
      this.activeTransfers.delete(file.name);
      
      throw error instanceof Error ? error : new TransferError("Failed to send file", error);
    } finally {
      // Clean up retry state
      this.retryHandler.cancelRetries(file.name);
      
      // Reset state only if it's not already being reset
      if (!this.stateManager.isCancelled()) {
        this.stateManager.resetTransferState('complete');
      }
    }
  }
}
