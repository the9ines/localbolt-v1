
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
}

export class DataChannelManager implements IDataChannelManager {
  private fileTransferService: FileTransferService | null = null;
  private stateChangeHandler: ((state: RTCDataChannelState) => void) | undefined;
  private isDisconnecting: boolean = false;
  private activeTransferFilename: string | null = null;
  private dataChannel: RTCDataChannel | null = null;

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
    
    this.dataChannel = channel;
    this.fileTransferService = new FileTransferService(
      channel,
      this.encryptionService,
      this.handleFileReceive.bind(this),
      this.handleProgress.bind(this)
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

  private handleFileReceive(file: Blob, filename: string) {
    console.log('[DATACHANNEL] File received:', filename);
    this.activeTransferFilename = null;
    this.onReceiveFile(file, filename);
  }

  private handleProgress(progress: TransferProgress) {
    if (progress.status === 'transferring') {
      this.activeTransferFilename = progress.filename;
    } else if (progress.status === 'canceled_by_sender' || progress.status === 'canceled_by_receiver') {
      this.activeTransferFilename = null;
    }
    this.onProgress(progress);
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
    try {
      this.activeTransferFilename = file.name;
      await this.fileTransferService.sendFile(file);
    } catch (error) {
      this.activeTransferFilename = null;
      throw error;
    }
  }

  cancelTransfer(filename: string, isReceiver: boolean = false): void {
    console.log('[DATACHANNEL] Cancelling transfer for:', filename);
    if (this.fileTransferService && this.activeTransferFilename === filename) {
      this.fileTransferService.cancelCurrentTransfer(filename, isReceiver);
      this.activeTransferFilename = null;
    }
  }

  pauseTransfer(filename: string): void {
    console.log('[DATACHANNEL] Pausing transfer for:', filename);
    if (this.fileTransferService && this.activeTransferFilename === filename) {
      this.fileTransferService.pauseTransfer(filename);
    } else {
      console.warn('[DATACHANNEL] Cannot pause: no active transfer for', filename);
    }
  }

  resumeTransfer(filename: string): void {
    console.log('[DATACHANNEL] Resuming transfer for:', filename);
    if (this.fileTransferService && this.activeTransferFilename === filename) {
      this.fileTransferService.resumeTransfer(filename);
    } else {
      console.warn('[DATACHANNEL] Cannot resume: no active transfer for', filename);
    }
  }

  isTransferActive(filename: string): boolean {
    return this.activeTransferFilename === filename;
  }

  disconnect(): void {
    if (this.isDisconnecting) {
      console.log('[DATACHANNEL] Already disconnecting, skipping redundant disconnect call');
      return;
    }

    console.log('[DATACHANNEL] Disconnecting data channel');
    this.isDisconnecting = true;

    try {
      if (this.activeTransferFilename) {
        console.log('[DATACHANNEL] Cancelling active transfer before disconnect');
        this.cancelTransfer(this.activeTransferFilename);
      }

      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.close();
      }

      if (this.stateChangeHandler) {
        this.stateChangeHandler('closed');
      }

      this.fileTransferService = null;
      this.stateChangeHandler = undefined;
      this.dataChannel = null;
      this.activeTransferFilename = null;
    } finally {
      this.isDisconnecting = false;
    }
  }
}
