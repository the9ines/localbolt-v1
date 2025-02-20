
import { FileTransferService, TransferProgress } from './FileTransferService';
import { EncryptionService } from './EncryptionService';
import { ConnectionError } from '@/types/webrtc-errors';

export class DataChannelManager {
  private dataChannel: RTCDataChannel | null = null;
  private fileTransferService: FileTransferService | null = null;

  constructor(
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onProgress?: (progress: TransferProgress) => void,
    private onError?: (error: Error) => void
  ) {}

  setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    console.log('[DATACHANNEL] Setting up data channel');
    
    this.dataChannel.onopen = () => {
      console.log('[DATACHANNEL] Channel opened');
    };

    this.dataChannel.onclose = () => {
      console.log('[DATACHANNEL] Channel closed');
      this.fileTransferService = null;
    };

    this.dataChannel.onerror = (error) => {
      console.error('[DATACHANNEL] Error:', error);
      if (this.onError) {
        this.onError(new ConnectionError("Data channel error", error));
      }
    };

    this.fileTransferService = new FileTransferService(
      this.dataChannel,
      this.encryptionService,
      this.onReceiveFile,
      this.onProgress
    );
  }

  async sendFile(file: File) {
    if (!this.fileTransferService) {
      throw new ConnectionError("No connection established");
    }
    await this.fileTransferService.sendFile(file);
  }

  cancelTransfer(filename: string) {
    if (!this.fileTransferService) {
      throw new ConnectionError("No connection established");
    }
    this.fileTransferService.cancelCurrentTransfer(filename);
  }

  createDataChannel(peerConnection: RTCPeerConnection, label: string): RTCDataChannel {
    const channel = peerConnection.createDataChannel(label);
    this.setupDataChannel(channel);
    return channel;
  }

  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.fileTransferService = null;
  }
}
