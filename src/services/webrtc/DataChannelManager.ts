
import { FileTransferService } from './FileTransferService';
import { TransferControlService } from './transfer/TransferControlService';
import { DataChannelMessageHandler } from './transfer/DataChannelMessageHandler';
import { type DataChannelHandler, type TransferProgress } from './types/transfer';
import { EncryptionService } from './EncryptionService';
import { TransferStateManager } from './transfer/TransferStateManager';
import { TransferManager } from './transfer/TransferManager';

export class DataChannelManager {
  private dataChannel: RTCDataChannel | null = null;
  private messageHandler: DataChannelMessageHandler | null = null;
  private fileTransferService: FileTransferService | null = null;
  private transferControlService: TransferControlService | null = null;
  private stateChangeHandler: ((state: RTCDataChannelState) => void) | null = null;
  private activeTransfers: Set<string> = new Set();
  private transferStateManager: TransferStateManager;
  private transferManager: TransferManager;

  constructor(
    private encryptionService: EncryptionService,
    private onFileReceive: (file: Blob, filename: string) => void,
    private onProgress: (progress: TransferProgress) => void,
    private onError: (error: Error) => void
  ) {
    console.log('[DATACHANNEL] Initializing DataChannelManager');
    this.transferStateManager = new TransferStateManager(this.onProgress);
    this.transferManager = new TransferManager(
      this.dataChannel!,
      this.encryptionService,
      this.onProgress
    );
  }

  setDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.setupDataChannelHandlers();
  }

  private setupDataChannelHandlers() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('[DATACHANNEL] Channel opened');
      this.stateChangeHandler?.('open');
    };

    this.dataChannel.onclose = () => {
      console.log('[DATACHANNEL] Channel closed');
      this.stateChangeHandler?.('closed');
    };

    this.dataChannel.onmessage = (event) => {
      this.messageHandler?.handleMessage(event);
    };
  }

  initializeServices() {
    if (!this.dataChannel) return;

    this.fileTransferService = new FileTransferService(
      this.dataChannel,
      this.encryptionService,
      this.onFileReceive,
      this.onProgress
    );
    
    this.transferControlService = new TransferControlService(
      this.dataChannel,
      this.transferStateManager,
      this.transferManager,
      this.onProgress
    );

    this.messageHandler = new DataChannelMessageHandler(
      this.transferManager,
      this.transferStateManager,
      this.onFileReceive
    );
  }

  hasActiveTransfers(): boolean {
    return this.activeTransfers.size > 0;
  }

  async sendFile(file: File) {
    if (!this.fileTransferService) throw new Error('File transfer service not initialized');
    await this.fileTransferService.sendFile(file);
    this.activeTransfers.add(file.name);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    if (!this.transferControlService) return;
    this.transferControlService.cancelCurrentTransfer(filename, isReceiver);
    this.activeTransfers.delete(filename);
  }

  pauseTransfer(filename: string) {
    if (!this.transferControlService) return;
    this.transferControlService.pauseTransfer(filename);
  }

  resumeTransfer(filename: string) {
    if (!this.transferControlService) return;
    this.transferControlService.resumeTransfer(filename);
  }

  pauseAllTransfers() {
    this.activeTransfers.forEach(filename => this.pauseTransfer(filename));
  }

  resumeAllTransfers() {
    this.activeTransfers.forEach(filename => this.resumeTransfer(filename));
  }

  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    this.cleanup();
  }

  setStateChangeHandler(handler: (state: RTCDataChannelState) => void) {
    console.log('[DATACHANNEL] Setting state change handler');
    this.stateChangeHandler = handler;
  }

  getTransferService(): FileTransferService | null {
    return this.fileTransferService;
  }

  getControlService(): TransferControlService | null {
    return this.transferControlService;
  }

  cleanup() {
    this.activeTransfers.clear();
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    this.dataChannel = null;
    this.messageHandler = null;
    this.fileTransferService = null;
    this.transferControlService = null;
    this.stateChangeHandler = null;
  }
}
