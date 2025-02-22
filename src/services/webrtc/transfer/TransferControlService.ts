
import type { FileChunkMessage } from '../types/transfer';
import type { TransferProgress } from '../types/transfer';
import { TransferStateManager } from './TransferStateManager';
import { TransferManager } from './TransferManager';

export class TransferControlService {
  constructor(
    private dataChannel: RTCDataChannel,
    private stateManager: TransferStateManager,
    private transferManager: TransferManager,
    private onProgress?: (progress: TransferProgress) => void
  ) {}

  cancelCurrentTransfer(filename: string, isReceiver: boolean = false) {
    console.log(`[TRANSFER] Cancelling transfer of ${filename}`);
    this.stateManager.handleCancel({ filename, isReceiver });
    this.transferManager.cancelTransfer(filename, isReceiver);
    
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      cancelled: true,
      cancelledBy: isReceiver ? 'receiver' : 'sender'
    };
    this.dataChannel.send(JSON.stringify(message));
  }

  pauseTransfer(filename: string) {
    console.log(`[TRANSFER] Initiating pause for ${filename}`);
    
    // First update local state
    this.stateManager.handlePause({ filename });
    this.transferManager.handlePause();

    // Then send pause message to peer
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      paused: true
    };
    
    try {
      this.dataChannel.send(JSON.stringify(message));
      
      // Get current progress and emit with paused status
      const currentTransfer = this.stateManager.getCurrentTransfer();
      if (currentTransfer?.progress && this.onProgress) {
        console.log('[TRANSFER] Emitting paused state with progress:', currentTransfer.progress);
        this.onProgress({
          ...currentTransfer.progress,
          filename,
          status: 'paused',
          currentChunk: currentTransfer.progress.currentChunk,
          totalChunks: currentTransfer.progress.totalChunks,
          loaded: currentTransfer.progress.loaded,
          total: currentTransfer.progress.total
        });
      }
      
      console.log('[TRANSFER] Pause initiated successfully');
    } catch (error) {
      console.error('[TRANSFER] Error during pause:', error);
      this.stateManager.reset();
    }
  }

  resumeTransfer(filename: string) {
    console.log(`[TRANSFER] Initiating resume for ${filename}`);
    
    // First update local state
    this.stateManager.handleResume({ filename });
    this.transferManager.handleResume();

    // Then send resume message to peer
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      resumed: true
    };
    
    try {
      this.dataChannel.send(JSON.stringify(message));
      
      // Get current progress and emit with transferring status
      const currentTransfer = this.stateManager.getCurrentTransfer();
      if (currentTransfer?.progress && this.onProgress) {
        console.log('[TRANSFER] Emitting resumed state with progress:', currentTransfer.progress);
        this.onProgress({
          ...currentTransfer.progress,
          filename,
          status: 'transferring',
          currentChunk: currentTransfer.progress.currentChunk,
          totalChunks: currentTransfer.progress.totalChunks,
          loaded: currentTransfer.progress.loaded,
          total: currentTransfer.progress.total
        });
      }
      
      console.log('[TRANSFER] Resume initiated successfully');
    } catch (error) {
      console.error('[TRANSFER] Error during resume:', error);
      this.stateManager.reset();
    }
  }
}
