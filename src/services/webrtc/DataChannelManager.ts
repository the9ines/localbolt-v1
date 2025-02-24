
import { FileTransferService } from './FileTransferService';
import { EncryptionService } from './EncryptionService';
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './FileTransferService';
import { TransportMode } from './protocol/ConnectionNegotiator';

export interface IDataChannelManager {
  setupDataChannel(channel: RTCDataChannel): void;
  setStateChangeHandler(handler: (state: RTCDataChannelState) => void): void;
  sendFile(file: File): Promise<void>;
  cancelTransfer(filename: string, isReceiver?: boolean): void;
  pauseTransfer(filename: string): void;
  resumeTransfer(filename: string): void;
  disconnect(): void;
  hasActiveTransfers(): boolean;
  setTransportMode(mode: TransportMode): void;
}

export class DataChannelManager implements IDataChannelManager {
  private fileTransferService: FileTransferService | null = null;
  private stateChangeHandler: ((state: RTCDataChannelState) => void) | undefined;
  private isDisconnecting: boolean = false;
  private activeTransfers: Set<string> = new Set();
  private currentTransportMode: TransportMode = TransportMode.INTERNET;

  constructor(
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onProgress: (progress: TransferProgress) => void,
    private onError: (error: WebRTCError) => void
  ) {
    console.log('[DATACHANNEL] Initializing DataChannelManager');
  }

  setTransportMode(mode: TransportMode) {
    console.log('[DATACHANNEL] Setting transport mode:', mode);
    this.currentTransportMode = mode;
    
    if (this.fileTransferService) {
      const chunkSize = this.getChunkSizeForMode(mode);
      this.fileTransferService.setChunkSize(chunkSize);
    }
  }

  private getChunkSizeForMode(mode: TransportMode): number {
    switch (mode) {
      case TransportMode.LOCAL:
        return 65536; // 64KB chunks for local network
      case TransportMode.INTERNET:
        return 16384; // 16KB chunks for internet
      case TransportMode.OFFLINE:
        return 32768; // 32KB chunks for offline/LAN
      default:
        return 16384; // Default to conservative size
    }
  }

  setupDataChannel(channel: RTCDataChannel): void {
    console.log('[DATACHANNEL] Setting up data channel');
    
    this.fileTransferService = new FileTransferService(
      channel,
      this.encryptionService,
      this.onReceiveFile,
      this.onProgress
    );

    // Set initial chunk size based on current transport mode
    this.fileTransferService.setChunkSize(
      this.getChunkSizeForMode(this.currentTransportMode)
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
