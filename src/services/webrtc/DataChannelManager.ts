
import { FileTransferService } from './FileTransferService';
import { EncryptionService } from './EncryptionService';
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './FileTransferService';

export class DataChannelManager {
  private fileTransferService: FileTransferService | null = null;
  private stateChangeHandler?: (state: RTCDataChannelState) => void;

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

    // Add state change listener to the data channel
    channel.onclose = () => {
      console.log('[DATACHANNEL] Channel closed');
      if (this.stateChangeHandler) {
        this.stateChangeHandler('closed');
      }
    };

    channel.onopen = () => {
      console.log('[DATACHANNEL] Channel opened');
      if (this.stateChangeHandler) {
        this.stateChangeHandler('open');
      }
    };
  }

  setStateChangeHandler(handler: (state: RTCDataChannelState) => void) {
    this.stateChangeHandler = handler;
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
    if (this.stateChangeHandler) {
      this.stateChangeHandler('closed');
    }
    this.fileTransferService = null;
    this.stateChangeHandler = undefined;
  }
}
