
import { TransferError } from '@/types/webrtc-errors';
import { EncryptionService } from './EncryptionService';
import { ChunkProcessor } from './transfer/ChunkProcessor';
import { TransferManager } from './transfer/TransferManager';
import { TransferStateManager } from './transfer/TransferStateManager';
import { DataChannelMessageHandler } from './transfer/DataChannelMessageHandler';
import { SendFileService } from './transfer/SendFileService';
import { TransferControlService } from './transfer/TransferControlService';
import type { TransferProgress } from './types/transfer';
import type { IFileTransferService } from './types/file-transfer';

export type { TransferProgress };

export class FileTransferService implements IFileTransferService {
  private transferManager: TransferManager;
  private chunkProcessor: ChunkProcessor;
  private stateManager: TransferStateManager;
  private messageHandler: DataChannelMessageHandler;
  private sendFileService: SendFileService;
  private transferControlService: TransferControlService;

  constructor(
    private dataChannel: RTCDataChannel,
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.chunkProcessor = new ChunkProcessor(encryptionService);
    this.transferManager = new TransferManager(dataChannel, this.chunkProcessor, onProgress);
    this.stateManager = new TransferStateManager(onProgress);
    this.messageHandler = new DataChannelMessageHandler(
      this.transferManager,
      this.stateManager,
      onReceiveFile
    );
    this.sendFileService = new SendFileService(dataChannel, this.chunkProcessor, this.stateManager);
    this.transferControlService = new TransferControlService(dataChannel, this.stateManager, this.transferManager);
    this.setupDataChannel();
  }

  private setupDataChannel() {
    this.dataChannel.onmessage = (event) => this.messageHandler.handleMessage(event);
    this.dataChannel.onclose = () => {
      console.log('[TRANSFER] Data channel closed, cleaning up transfer state');
      this.stateManager.reset();
    };
  }

  async sendFile(file: File) {
    return this.sendFileService.sendFile(file);
  }

  cancelCurrentTransfer(filename: string, isReceiver: boolean = false) {
    this.transferControlService.cancelCurrentTransfer(filename, isReceiver);
  }

  pauseTransfer(filename: string) {
    this.transferControlService.pauseTransfer(filename);
  }

  resumeTransfer(filename: string) {
    this.transferControlService.resumeTransfer(filename);
  }
}
