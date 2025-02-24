
import type { TransferProgress, FileChunkMessage } from '../types/transfer';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferError } from '@/types/webrtc-errors';

export class TransferManager {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private activeTransfers: Set<string> = new Set();
  private chunkProcessor: ChunkProcessor;
  private transferProgress: { [key: string]: TransferProgress } = {};
  private isPaused: boolean = false;
  private readonly PROGRESS_STORAGE_KEY = 'transfer_progress';
  private readonly CHUNKS_STORAGE_KEY = 'transfer_chunks';

  constructor(
    private dataChannel: RTCDataChannel,
    chunkProcessor: ChunkProcessor,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.chunkProcessor = chunkProcessor;
    this.loadSavedProgress();
  }

  private loadSavedProgress() {
    try {
      const savedProgress = localStorage.getItem(this.PROGRESS_STORAGE_KEY);
      const savedChunks = localStorage.getItem(this.CHUNKS_STORAGE_KEY);
      
      if (savedProgress) {
        this.transferProgress = JSON.parse(savedProgress);
        console.log('[TRANSFER] Loaded saved progress:', this.transferProgress);
      }
      
      if (savedChunks) {
        const parsedChunks = JSON.parse(savedChunks);
        // Convert stored base64 chunks back to Blobs
        Object.keys(parsedChunks).forEach(filename => {
          this.chunksBuffer[filename] = parsedChunks[filename].map((chunk: string) => 
            new Blob([Uint8Array.from(atob(chunk), c => c.charCodeAt(0))])
          );
        });
        console.log('[TRANSFER] Restored chunks for files:', Object.keys(this.chunksBuffer));
      }
    } catch (error) {
      console.error('[TRANSFER] Failed to load saved progress:', error);
      // Clear potentially corrupted data
      localStorage.removeItem(this.PROGRESS_STORAGE_KEY);
      localStorage.removeItem(this.CHUNKS_STORAGE_KEY);
    }
  }

  private saveProgress() {
    try {
      localStorage.setItem(this.PROGRESS_STORAGE_KEY, JSON.stringify(this.transferProgress));
      
      // Convert Blobs to base64 for storage
      const chunksToStore: { [key: string]: string[] } = {};
      Object.keys(this.chunksBuffer).forEach(filename => {
        chunksToStore[filename] = [];
        this.chunksBuffer[filename].forEach(blob => {
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result) {
              const base64 = btoa(
                new Uint8Array(reader.result as ArrayBuffer)
                  .reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
              chunksToStore[filename].push(base64);
            }
          };
          reader.readAsArrayBuffer(blob);
        });
      });
      
      localStorage.setItem(this.CHUNKS_STORAGE_KEY, JSON.stringify(chunksToStore));
      console.log('[TRANSFER] Progress saved');
    } catch (error) {
      console.error('[TRANSFER] Failed to save progress:', error);
    }
  }

  getCurrentProgress(filename: string): TransferProgress {
    return this.transferProgress[filename] || {
      filename,
      currentChunk: 0,
      totalChunks: 0,
      loaded: 0,
      total: 0
    };
  }

  private updateProgress(
    filename: string,
    loaded: number,
    total: number,
    status: TransferProgress['status'] = 'transferring'
  ) {
    const progress: TransferProgress = {
      filename,
      currentChunk: 0,
      totalChunks: 0,
      loaded,
      total,
      status
    };

    this.transferProgress[filename] = progress;
    this.saveProgress();

    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  cancelTransfer(filename: string, isReceiver: boolean) {
    this.activeTransfers.delete(filename);
    
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      cancelled: true,
      cancelledBy: isReceiver ? 'receiver' : 'sender'
    };
    
    this.dataChannel.send(JSON.stringify(message));
    this.handleCleanup(filename);
  }

  handleCleanup(filename: string) {
    if (this.chunksBuffer[filename]) {
      delete this.chunksBuffer[filename];
      delete this.transferProgress[filename];
      
      // Clean up stored progress
      this.saveProgress();
      
      this.updateProgress(
        filename,
        0,
        0,
        'canceled_by_sender'
      );
    }
  }

  requestMissingChunks(filename: string, missingChunks: number[]): void {
    console.log(`[TRANSFER] Requesting missing chunks for ${filename}:`, missingChunks);
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      requestMissingChunks: true,
      missingChunks
    };
    this.dataChannel.send(JSON.stringify(message));
  }

  async processReceivedChunk(
    filename: string,
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
    fileSize: number
  ): Promise<Blob | null> {
    if (!this.chunksBuffer[filename]) {
      this.chunksBuffer[filename] = new Array(totalChunks);
      this.activeTransfers.add(filename);
    }

    try {
      if (this.isPaused) {
        console.log('[TRANSFER] Skipping chunk processing while paused');
        return null;
      }

      const decryptedChunk = await this.chunkProcessor.decryptChunk(chunk);
      const validation = await this.chunkProcessor.validateChunk(decryptedChunk);
      
      this.chunksBuffer[filename][chunkIndex] = decryptedChunk;
      
      const received = this.chunksBuffer[filename].filter(Boolean).length;
      
      this.updateProgress(
        filename,
        received * (fileSize / totalChunks),
        fileSize,
        'transferring'
      );

      if (received === totalChunks) {
        this.updateProgress(filename, fileSize, fileSize, 'validating');
        
        const fileChecksum = await this.chunkProcessor.calculateFileChecksum(
          this.chunksBuffer[filename]
        );
        
        const completeFile = new Blob(this.chunksBuffer[filename]);
        this.activeTransfers.delete(filename);
        delete this.chunksBuffer[filename];
        
        this.transferProgress[filename].checksum = fileChecksum;
        this.saveProgress();
        
        if (this.onProgress) {
          this.onProgress(this.transferProgress[filename]);
        }
        
        return completeFile;
      }
    } catch (error) {
      this.activeTransfers.delete(filename);
      delete this.chunksBuffer[filename];
      throw error;
    }

    return null;
  }

  handlePause() {
    console.log('[TRANSFER] Transfer manager paused');
    this.isPaused = true;
    this.saveProgress();
  }

  handleResume() {
    console.log('[TRANSFER] Transfer manager resumed');
    this.isPaused = false;
  }

  isPauseActive() {
    return this.isPaused;
  }

  isTransferActive(filename: string): boolean {
    return this.activeTransfers.has(filename);
  }
}
