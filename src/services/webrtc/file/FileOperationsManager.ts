
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from '../types/transfer';
import { WebRTCContext } from '../context/WebRTCContext';

/**
 * Manages file operations including sending, canceling, pausing, and resuming transfers.
 */
export class FileOperationsManager {
  constructor(private context: WebRTCContext) {}

  /**
   * Sends a file to the connected peer.
   */
  async sendFile(file: File): Promise<void> {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    if (!this.context) {
      throw new WebRTCError("WebRTC context not initialized");
    }
    
    const channelManager = this.getDataChannelManager();
    await channelManager.sendFile(file);
  }

  /**
   * Cancels an active file transfer.
   */
  cancelTransfer(filename: string, isReceiver: boolean = false): void {
    console.log('[WEBRTC] Cancelling transfer:', filename);
    if (!this.context) return;
    
    const channelManager = this.getDataChannelManager();
    channelManager.cancelTransfer(filename, isReceiver);
  }

  /**
   * Pauses an active file transfer.
   */
  pauseTransfer(filename: string): void {
    console.log('[WEBRTC] Pausing transfer for:', filename);
    if (!this.context) return;
    
    const channelManager = this.getDataChannelManager();
    channelManager.pauseTransfer(filename);
  }

  /**
   * Resumes a paused file transfer.
   */
  resumeTransfer(filename: string): void {
    console.log('[WEBRTC] Resuming transfer for:', filename);
    if (!this.context) return;
    
    const channelManager = this.getDataChannelManager();
    channelManager.resumeTransfer(filename);
  }

  /**
   * Sets a callback to receive progress updates.
   */
  setProgressCallback(callback: (progress: TransferProgress) => void): void {
    if (!this.context) return;
    this.context.setProgressCallback(callback);
  }

  private getDataChannelManager(): any {
    // This is a temporary method - in a real implementation,
    // we would properly expose the DataChannelManager through the context
    // or use a more structured dependency system
    return (this.context as any).dataChannelManager;
  }
}
