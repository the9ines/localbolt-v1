
import type { TransferProgress, FileChunkMessage, TransferStatus } from '../types/transfer';
import { ChunkProcessor } from './ChunkProcessor';
import { TransferError, TransferErrorCode } from '@/types/webrtc-errors';

interface TransferState {
  chunks: Blob[];
  receivedChunks: Set<number>;
  startTime: number;
  lastUpdateTime: number;
  bytesReceived: number;
  status: TransferStatus;
}

export class TransferManager {
  private transfers: Map<string, TransferState> = new Map();
  private readonly MAX_TRANSFER_SIZE = 2147483648; // 2GB

  constructor(
    private dataChannel: RTCDataChannel,
    private chunkProcessor: ChunkProcessor,
    private onProgress?: (progress: TransferProgress) => void
  ) {}

  private initializeTransfer(filename: string, totalChunks: number): void {
    this.transfers.set(filename, {
      chunks: new Array(totalChunks),
      receivedChunks: new Set(),
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      bytesReceived: 0,
      status: 'initializing'
    });
  }

  private calculateTransferStats(transfer: TransferState, total: number): Partial<TransferProgress> {
    const now = Date.now();
    const elapsedSeconds = (now - transfer.startTime) / 1000;
    const speed = transfer.bytesReceived / elapsedSeconds;
    const remaining = total - transfer.bytesReceived;
    const estimatedTimeRemaining = speed > 0 ? remaining / speed : 0;

    return {
      speed,
      estimatedTimeRemaining
    };
  }

  async processReceivedChunk(
    filename: string,
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
    fileSize: number
  ): Promise<Blob | null> {
    try {
      if (fileSize > this.MAX_TRANSFER_SIZE) {
        throw new TransferError(
          `File size exceeds maximum allowed size of ${this.MAX_TRANSFER_SIZE} bytes`,
          TransferErrorCode.FILE_TOO_LARGE
        );
      }

      if (!this.transfers.has(filename)) {
        this.initializeTransfer(filename, totalChunks);
      }

      const transfer = this.transfers.get(filename)!;
      
      if (transfer.status === 'canceled_by_sender' || transfer.status === 'canceled_by_receiver') {
        return null;
      }

      const decryptedChunk = await this.chunkProcessor.decryptChunk(chunk);
      transfer.chunks[chunkIndex] = decryptedChunk;
      transfer.receivedChunks.add(chunkIndex);
      transfer.bytesReceived += decryptedChunk.size;
      transfer.status = 'transferring';

      this.updateProgress(filename, transfer, chunkIndex, totalChunks, fileSize);

      if (transfer.receivedChunks.size === totalChunks) {
        const completeFile = new Blob(transfer.chunks);
        if (completeFile.size !== fileSize) {
          throw new TransferError(
            "Assembled file size doesn't match expected size",
            TransferErrorCode.MISSING_CHUNKS
          );
        }
        transfer.status = 'completed';
        this.updateProgress(filename, transfer, totalChunks, totalChunks, fileSize);
        this.transfers.delete(filename);
        return completeFile;
      }

      return null;
    } catch (error) {
      const transfer = this.transfers.get(filename);
      if (transfer) {
        transfer.status = 'error';
        this.updateProgress(filename, transfer, chunkIndex, totalChunks, fileSize);
      }
      throw error;
    }
  }

  private updateProgress(
    filename: string,
    transfer: TransferState,
    currentChunk: number,
    totalChunks: number,
    total: number
  ): void {
    if (this.onProgress) {
      this.onProgress({
        filename,
        currentChunk,
        totalChunks,
        loaded: transfer.bytesReceived,
        total,
        status: transfer.status,
        ...this.calculateTransferStats(transfer, total)
      });
    }
  }

  cancelTransfer(filename: string, isReceiver: boolean): void {
    const transfer = this.transfers.get(filename);
    if (transfer) {
      transfer.status = isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      const message: FileChunkMessage = {
        type: 'transfer-control',
        filename,
        controlType: 'cancel',
        cancelledBy: isReceiver ? 'receiver' : 'sender'
      };
      
      this.dataChannel.send(JSON.stringify(message));
      this.handleCleanup(filename);
    }
  }

  handleCleanup(filename: string): void {
    const transfer = this.transfers.get(filename);
    if (transfer) {
      // Update final progress before cleanup
      this.updateProgress(
        filename,
        transfer,
        transfer.receivedChunks.size,
        transfer.chunks.length,
        transfer.bytesReceived
      );
      this.transfers.delete(filename);
    }
  }

  isTransferActive(filename: string): boolean {
    const transfer = this.transfers.get(filename);
    return transfer?.status === 'transferring' || transfer?.status === 'initializing';
  }
}
