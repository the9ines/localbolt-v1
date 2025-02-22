
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
    
    const currentTransfer = this.stateManager.getCurrentTransfer();
    if (!currentTransfer?.progress) {
      console.warn('[TRANSFER] No active transfer to pause');
      return;
    }
    
    // First notify peer about pause
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      paused: true
    };
    
    try {
      this.dataChannel.send(JSON.stringify(message));
      
      // Then update local state
      const success = this.stateManager.handlePause({ filename });
      
      if (success && this.onProgress) {
        // Emit progress with paused status and current progress values
        this.onProgress({
          ...currentTransfer.progress,
          filename,
          status: 'paused'
        });
      }
      
      // Finally pause the transfer manager
      this.transferManager.handlePause();
      console.log('[TRANSFER] Pause initiated successfully');
    } catch (error) {
      console.error('[TRANSFER] Error during pause:', error);
      this.stateManager.reset();
    }
  }

  resumeTransfer(filename: string) {
    console.log(`[TRANSFER] Initiating resume for ${filename}`);
    
    const currentTransfer = this.stateManager.getCurrentTransfer();
    if (!currentTransfer?.progress) {
      console.warn('[TRANSFER] No active transfer to resume');
      return;
    }
    
    // First notify peer about resume
    const message: FileChunkMessage = {
      type: 'file-chunk',
      filename,
      resumed: true
    };
    
    try {
      this.dataChannel.send(JSON.stringify(message));
      
      // Then update local state
      const success = this.stateManager.handleResume({ filename });
      
      if (success && this.onProgress) {
        // Emit progress with transferring status and current progress values
        this.onProgress({
          ...currentTransfer.progress,
          filename,
          status: 'transferring'
        });
      }
      
      // Finally resume the transfer manager
      this.transferManager.handleResume();
      console.log('[TRANSFER] Resume initiated successfully');
    } catch (error) {
      console.error('[TRANSFER] Error during resume:', error);
      this.stateManager.reset();
    }
  }
}
