
import { FileTransferService } from './FileTransferService';
import { EncryptionService } from './EncryptionService';
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './FileTransferService';

export interface IDataChannelManager {
  setupDataChannel(channel: RTCDataChannel): void;
  setStateChangeHandler(handler: (state: RTCDataChannelState) => void): void;
  sendFile(file: File): Promise<void>;
  cancelTransfer(filename: string, isReceiver?: boolean): void;
  pauseTransfer(filename: string): void;
  resumeTransfer(filename: string): void;
  disconnect(): void;
  hasActiveTransfers(): boolean;
}

export class DataChannelManager implements IDataChannelManager {
  private fileTransferService: FileTransferService | null = null;
  private stateChangeHandler: ((state: RTCDataChannelState) => void) | undefined;
  private isDisconnecting: boolean = false;
  private activeTransfers: Set<string> = new Set();

  constructor(
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onProgress: (progress: TransferProgress) => void,
    private onError: (error: WebRTCError) => void
  ) {
    console.log('[DATACHANNEL] Initializing DataChannelManager');
  }

  setupDataChannel(channel: RTCDataChannel): void {
    console.log('[DATACHANNEL] Setting up data channel');
    
    this.fileTransferService = new FileTransferService(
      channel,
      this.encryptionService,
      this.onReceiveFile,
      this.onProgress
    );

    channel.onclose = () => {
      console.log('[DATACHANNEL] Channel closed');
      if (this.stateChangeHandler && !this.isDisconnecting) {
        this.stateChangeHandler('closed');
      }
    };

    channel.onopen = () => {
      console.log('[DATACHANNEL] Channel opened');
      if (this.stateChangeHandler && !this.isDisconnecting) {
        this.stateChangeHandler('open');
      }
    };

    channel.onerror = (error) => {
      console.error('[DATACHANNEL] Error:', error);
      this.onError(new WebRTCError('Data channel error occurred', error));
    };
  }

  setStateChangeHandler(handler: (state: RTCDataChannelState) => void): void {
    console.log('[DATACHANNEL] Setting state change handler');
    this.stateChangeHandler = handler;
  }

  async sendFile(file: File): Promise<void> {
    console.log('[DATACHANNEL] Attempting to send file:', file.name);
    if (!this.fileTransferService) {
      throw new WebRTCError("No active data channel");
    }
    this.activeTransfers.add(file.name);
    await this.fileTransferService.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false): void {
    console.log('[DATACHANNEL] Cancelling transfer for:', filename);
    if (this.fileTransferService) {
      this.fileTransferService.cancelCurrentTransfer(filename, isReceiver);
      this.activeTransfers.delete(filename);
    }
  }

  pauseTransfer(filename: string): void {
    console.log('[DATACHANNEL] Pausing transfer for:', filename);
    if (this.fileTransferService) {
      this.fileTransferService.pauseTransfer(filename);
    }
  }

  resumeTransfer(filename: string): void {
    console.log('[DATACHANNEL] Resuming transfer for:', filename);
    if (this.fileTransferService) {
      this.fileTransferService.resumeTransfer(filename);
    }
  }

  hasActiveTransfers(): boolean {
    return this.activeTransfers.size > 0;
  }

  pauseAllTransfers(): void {
    console.log('[DATACHANNEL] Pausing all active transfers');
    this.activeTransfers.forEach(filename => {
      this.pauseTransfer(filename);
    });
  }

  resumeAllTransfers(): void {
    console.log('[DATACHANNEL] Resuming all active transfers');
    this.activeTransfers.forEach(filename => {
      this.resumeTransfer(filename);
    });
  }

  disconnect(): void {
    if (this.isDisconnecting) {
      console.log('[DATACHANNEL] Already disconnecting, skipping redundant disconnect call');
      return;
    }

    console.log('[DATACHANNEL] Disconnecting data channel');
    this.isDisconnecting = true;

    try {
      if (this.stateChangeHandler) {
        this.stateChangeHandler('closed');
      }
      this.fileTransferService = null;
      this.stateChangeHandler = undefined;
      this.activeTransfers.clear();
    } finally {
      this.isDisconnecting = false;
    }
  }
}
