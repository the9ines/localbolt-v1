
import { FileTransferService } from './FileTransferService';
import { EncryptionService } from './EncryptionService';
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './FileTransferService';

export class DataChannelManager {
  private fileTransferService: FileTransferService | null = null;

  constructor(
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onProgress: (progress: TransferProgress) => void,
    private onError: (error: WebRTCError) => void
  ) {}

  setupDataChannel(channel: RTCDataChannel) {
    this.fileTransferService = new FileTransferService(
      channel,
      this.encryptionService,
      this.onReceiveFile,
      this.onProgress
    );
  }

  async sendFile(file: File) {
    if (!this.fileTransferService) {
      throw new WebRTCError("No active data channel");
    }
    await this.fileTransferService.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    if (this.fileTransferService) {
      this.fileTransferService.cancelCurrentTransfer(filename, isReceiver);
    }
  }

  disconnect() {
    this.fileTransferService = null;
  }
}
