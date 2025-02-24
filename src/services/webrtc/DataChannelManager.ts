
import { FileTransferService } from './FileTransferService';
import { TransferControlService } from './transfer/TransferControlService';
import type { DataChannelMessageHandler } from './transfer/DataChannelMessageHandler';
import type { DataChannelHandler } from './types/transfer';

export class DataChannelManager {
  private dataChannel: RTCDataChannel | null = null;
  private messageHandler: DataChannelMessageHandler | null = null;
  private fileTransferService: FileTransferService | null = null;
  private transferControlService: TransferControlService | null = null;
  private stateChangeHandler: ((state: RTCDataChannelState) => void) | null = null;

  constructor() {
    console.log('[DATACHANNEL] Initializing DataChannelManager');
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

  initializeServices(handlers: DataChannelHandler) {
    this.fileTransferService = new FileTransferService(this.dataChannel!, handlers);
    this.transferControlService = new TransferControlService(this.dataChannel!, handlers);

    // Initialize message handler
    this.messageHandler = new DataChannelMessageHandler(
      this.fileTransferService,
      this.transferControlService
    );
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
