import { EncryptionService } from './EncryptionService';
import { TransferError, TransferErrorCode, WebRTCError } from '@/types/webrtc-errors';
import { TransferProgress } from './types/transfer';

export interface IDataChannelManager {
  setupDataChannel: (dataChannel: RTCDataChannel) => void;
  sendFile: (file: File) => Promise<void>;
  disconnect: () => void;
  cancelTransfer: (filename: string, isReceiver?: boolean) => void;
  setStateChangeHandler: (handler: (state: RTCDataChannelState) => void) => void;
}

interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

interface FileTransferMessage {
  type: 'metadata' | 'chunk' | 'complete' | 'cancel';
  filename?: string;
  metadata?: FileMetadata;
  chunk?: ArrayBuffer;
  chunkIndex?: number;
  totalChunks?: number;
}

export class DataChannelManager implements IDataChannelManager {
  private dataChannel: RTCDataChannel | null = null;
  private stateChangeHandler: ((state: RTCDataChannelState) => void) | null = null;
  private currentFile: File | null = null;
  private receivingFile: {
    metadata: FileMetadata;
    chunks: ArrayBuffer[];
    receivedChunks: number;
  } | null = null;
  private CHUNK_SIZE = 16384; // 16KB chunks

  constructor(
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onProgress: (progress: TransferProgress) => void,
    private onError: (error: WebRTCError) => void
  ) {}

  public setupDataChannel(dataChannel: RTCDataChannel) {
    this.dataChannel = dataChannel;
    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.onmessage = this.handleMessage.bind(this);
    this.dataChannel.onclose = () => this.stateChangeHandler?.('closed');
    this.dataChannel.onopen = () => this.stateChangeHandler?.('open');
    this.dataChannel.onerror = (event) => {
      this.onError(new TransferError(
        "Data channel error",
        TransferErrorCode.CHANNEL_ERROR,
        event
      ));
    };
  }

  private async handleMessage(event: MessageEvent) {
    try {
      if (typeof event.data === 'string') {
        const message: FileTransferMessage = JSON.parse(event.data);
        await this.handleFileTransferMessage(message);
      } else if (event.data instanceof ArrayBuffer) {
        await this.handleFileChunk(event.data);
      }
    } catch (error) {
      this.onError(new TransferError(
        "Failed to process message",
        TransferErrorCode.MESSAGE_ERROR,
        error
      ));
    }
  }

  private async handleFileTransferMessage(message: FileTransferMessage) {
    switch (message.type) {
      case 'metadata':
        if (message.metadata) {
          this.receivingFile = {
            metadata: message.metadata,
            chunks: new Array(Math.ceil(message.metadata.size / this.CHUNK_SIZE)),
            receivedChunks: 0
          };
          this.onProgress({
            filename: message.metadata.name,
            currentChunk: 0,
            totalChunks: Math.ceil(message.metadata.size / this.CHUNK_SIZE),
            loaded: 0,
            total: message.metadata.size,
            status: 'initializing'
          });
        }
        break;

      case 'complete':
        if (this.receivingFile && message.filename) {
          const blob = new Blob(this.receivingFile.chunks, { type: this.receivingFile.metadata.type });
          this.onReceiveFile(blob, message.filename);
          this.onProgress({
            filename: message.filename,
            currentChunk: this.receivingFile.chunks.length,
            totalChunks: this.receivingFile.chunks.length,
            loaded: this.receivingFile.metadata.size,
            total: this.receivingFile.metadata.size,
            status: 'completed'
          });
          this.receivingFile = null;
        }
        break;

      case 'cancel':
        if (message.filename) {
          this.handleTransferCancellation(message.filename, true);
        }
        break;
    }
  }

  private async handleFileChunk(chunk: ArrayBuffer) {
    if (!this.receivingFile) return;

    try {
      const decryptedChunk = await this.encryptionService.decrypt(chunk);
      const view = new DataView(decryptedChunk);
      const chunkIndex = view.getUint32(0);
      const actualData = decryptedChunk.slice(4);

      this.receivingFile.chunks[chunkIndex] = actualData;
      this.receivingFile.receivedChunks++;

      this.onProgress({
        filename: this.receivingFile.metadata.name,
        currentChunk: this.receivingFile.receivedChunks,
        totalChunks: this.receivingFile.chunks.length,
        loaded: this.receivingFile.receivedChunks * this.CHUNK_SIZE,
        total: this.receivingFile.metadata.size,
        status: 'transferring'
      });
    } catch (error) {
      this.onError(new TransferError(
        "Failed to process file chunk",
        TransferErrorCode.CHUNK_ERROR,
        error
      ));
    }
  }

  public async sendFile(file: File): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new TransferError('Data channel not ready', TransferErrorCode.CHANNEL_NOT_READY);
    }

    this.currentFile = file;
    const metadata: FileMetadata = {
      name: file.name,
      size: file.size,
      type: file.type
    };

    try {
      // Send metadata first
      this.dataChannel.send(JSON.stringify({
        type: 'metadata',
        metadata
      }));

      const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        if (!this.currentFile) break; // Transfer was cancelled

        const start = i * this.CHUNK_SIZE;
        const end = Math.min(start + this.CHUNK_SIZE, file.size);
        const chunk = await file.slice(start, end).arrayBuffer();
        
        // Prepend chunk index to the chunk data
        const chunkWithIndex = new ArrayBuffer(chunk.byteLength + 4);
        const view = new DataView(chunkWithIndex);
        view.setUint32(0, i);
        new Uint8Array(chunkWithIndex).set(new Uint8Array(chunk), 4);

        const encryptedChunk = await this.encryptionService.encrypt(chunkWithIndex);
        this.dataChannel.send(encryptedChunk);

        this.onProgress({
          filename: file.name,
          currentChunk: i + 1,
          totalChunks,
          loaded: end,
          total: file.size,
          status: 'transferring'
        });
      }

      if (this.currentFile) {
        this.dataChannel.send(JSON.stringify({
          type: 'complete',
          filename: file.name
        }));
        this.currentFile = null;
      }
    } catch (error) {
      this.currentFile = null;
      throw new TransferError(
        "Failed to send file",
        TransferErrorCode.SEND_ERROR,
        error
      );
    }
  }

  public disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.currentFile = null;
    this.receivingFile = null;
  }

  public cancelTransfer(filename: string, isReceiver: boolean = false) {
    if (isReceiver) {
      this.receivingFile = null;
    } else {
      this.currentFile = null;
    }

    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'cancel',
        filename
      }));
    }

    this.onProgress({
      filename,
      currentChunk: 0,
      totalChunks: 0,
      loaded: 0,
      total: 0,
      status: isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender'
    });
  }

  private handleTransferCancellation(filename: string, bySender: boolean) {
    if (bySender) {
      this.receivingFile = null;
    } else {
      this.currentFile = null;
    }

    this.onProgress({
      filename,
      currentChunk: 0,
      totalChunks: 0,
      loaded: 0,
      total: 0,
      status: bySender ? 'canceled_by_sender' : 'canceled_by_receiver'
    });
  }

  public setStateChangeHandler(handler: (state: RTCDataChannelState) => void) {
    this.stateChangeHandler = handler;
  }
}
