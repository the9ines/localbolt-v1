
import { DataChannelManager } from '../DataChannelManager';
import type { TransferProgress } from '../types/transfer';
import { WebRTCStateManager } from '../managers/WebRTCStateManager';

export class FileTransferService {
  constructor(
    private dataChannelManager: DataChannelManager,
    private stateManager: WebRTCStateManager
  ) {}

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    await this.dataChannelManager.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    console.log('[WEBRTC] Cancelling transfer:', filename);
    this.dataChannelManager.cancelTransfer(filename, isReceiver);
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.stateManager.setProgressCallback(callback);
  }
}
