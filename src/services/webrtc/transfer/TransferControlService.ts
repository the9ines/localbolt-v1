
import type { DataChannel } from '../types/data-channel';
import type { FileChunkMessage, TransferProgress } from '../types/transfer';
import type { TransferManager } from './TransferManager';
import type { TransferStateManager } from './TransferStateManager';

export class TransferControlService {
  constructor(
    private dataChannel: DataChannel,
    private stateManager: TransferStateManager,
    private transferManager: TransferManager,
    private onProgress?: (progress: TransferProgress) => void
  ) {}

  cancelCurrentTransfer(filename: string, isReceiver: boolean = false) {
    console.log('[TRANSFER] Cancelling transfer:', filename);
    
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      cancelled: true,
      cancelledBy: isReceiver ? 'receiver' : 'sender'
    };

    this.dataChannel.send(JSON.stringify(message));
    this.stateManager.handleCancellation(filename, !isReceiver);
  }

  pauseTransfer(filename: string) {
    console.log('[TRANSFER] Pausing transfer:', filename);
    
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      paused: true
    };

    this.dataChannel.send(JSON.stringify(message));
    
    const transfer = this.transferManager.getTransfer(filename);
    if (transfer) {
      const progress: TransferProgress = {
        filename,
        status: 'paused',
        sending: true,
        loaded: transfer.loaded,
        total: transfer.total,
        currentChunk: transfer.currentChunk,
        totalChunks: transfer.totalChunks
      };
      
      if (this.onProgress) {
        this.onProgress(progress);
      }
    }
  }

  resumeTransfer(filename: string) {
    console.log('[TRANSFER] Resuming transfer:', filename);
    
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      resumed: true
    };

    this.dataChannel.send(JSON.stringify(message));
    
    const transfer = this.transferManager.getTransfer(filename);
    if (transfer) {
      const progress: TransferProgress = {
        filename,
        status: 'transferring',
        sending: true,
        loaded: transfer.loaded,
        total: transfer.total,
        currentChunk: transfer.currentChunk,
        totalChunks: transfer.totalChunks
      };
      
      if (this.onProgress) {
        this.onProgress(progress);
      }
    }
  }
}
