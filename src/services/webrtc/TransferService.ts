
import { DataChannelManager } from './DataChannelManager';
import type { TransferProgress } from './types/transfer';

export class TransferService {
  constructor(
    private dataChannelManager: DataChannelManager,
    private onProgress?: (progress: TransferProgress) => void
  ) {}

  setProgressCallback(callback: (progress: TransferProgress) => void): void {
    this.onProgress = callback;
  }

  async sendFile(file: File): Promise<void> {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    await this.dataChannelManager.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false): void {
    console.log('[WEBRTC] Cancelling transfer:', filename);
    this.dataChannelManager.cancelTransfer(filename, isReceiver);
  }

  pauseTransfer(filename: string): void {
    console.log('[WEBRTC] Pausing transfer for:', filename);
    this.dataChannelManager.pauseTransfer(filename);
  }

  resumeTransfer(filename: string): void {
    console.log('[WEBRTC] Resuming transfer for:', filename);
    this.dataChannelManager.resumeTransfer(filename);
  }
}
