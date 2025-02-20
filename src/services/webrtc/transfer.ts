
import { FileChunkMessage, WebRTCError, WebRTCErrorCode, TransferProgress, CancelTransferMessage } from './types';
import { EncryptionService } from './encryption';

export class TransferService {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private activeTransfers: Set<string> = new Set();
  private transferAbortControllers: { [key: string]: AbortController } = {};

  constructor(
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {}

  async handleReceivedMessage(dataChannel: RTCDataChannel, event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'cancel-transfer') {
        const cancelMessage = message as CancelTransferMessage;
        console.log(`[TRANSFER] Received cancellation for ${cancelMessage.filename}`);
        this.handleCancellation(cancelMessage.filename);
        return;
      }

      const fileMessage = message as FileChunkMessage;
      console.log(`[TRANSFER] Receiving chunk ${fileMessage.chunkIndex + 1}/${fileMessage.totalChunks} for ${fileMessage.filename}`);
      
      if (!this.chunksBuffer[fileMessage.filename]) {
        console.log(`[TRANSFER] Starting new transfer for ${fileMessage.filename}`);
        this.chunksBuffer[fileMessage.filename] = [];
        this.activeTransfers.add(fileMessage.filename);
      }

      if (!this.activeTransfers.has(fileMessage.filename)) {
        console.log(`[TRANSFER] Transfer cancelled for ${fileMessage.filename}`);
        return;
      }

      try {
        const encryptedChunk = Uint8Array.from(atob(fileMessage.chunk), c => c.charCodeAt(0));
        const decryptedChunk = await this.encryptionService.decryptChunk(encryptedChunk);
        this.chunksBuffer[fileMessage.filename][fileMessage.chunkIndex] = new Blob([decryptedChunk]);

        if (this.onProgress) {
          const chunksReceived = this.chunksBuffer[fileMessage.filename].filter(Boolean).length;
          const bytesTransferred = chunksReceived * 16384; // Approximate for progress
          const progress: TransferProgress = {
            filename: fileMessage.filename,
            bytesTransferred: Math.min(bytesTransferred, fileMessage.fileSize),
            totalBytes: fileMessage.fileSize,
            percent: (chunksReceived / fileMessage.totalChunks) * 100,
            type: 'download'
          };
          this.onProgress(progress);
        }

        if (this.chunksBuffer[fileMessage.filename].filter(Boolean).length === fileMessage.totalChunks) {
          console.log(`[TRANSFER] Completed transfer of ${fileMessage.filename}`);
          const file = new Blob(this.chunksBuffer[fileMessage.filename]);
          delete this.chunksBuffer[fileMessage.filename];
          this.activeTransfers.delete(fileMessage.filename);
          this.onReceiveFile(file, fileMessage.filename);
        }
      } catch (error) {
        throw new WebRTCError(
          'Failed to decrypt received chunk',
          WebRTCErrorCode.DECRYPTION_FAILED,
          error
        );
      }
    } catch (error) {
      const webRTCError = error instanceof WebRTCError ? error : new WebRTCError(
        'Failed to process received message',
        WebRTCErrorCode.TRANSFER_FAILED,
        error
      );
      console.error('[TRANSFER] Error:', webRTCError);
      this.onError(webRTCError);
    }
  }

  private handleCancellation(filename: string) {
    if (this.chunksBuffer[filename]) {
      delete this.chunksBuffer[filename];
    }
    this.activeTransfers.delete(filename);
    if (this.transferAbortControllers[filename]) {
      this.transferAbortControllers[filename].abort();
      delete this.transferAbortControllers[filename];
    }
    
    this.onError(new WebRTCError(
      'File transfer cancelled',
      WebRTCErrorCode.TRANSFER_CANCELLED
    ));
  }

  async cancelTransfer(dataChannel: RTCDataChannel, filename: string) {
    if (!dataChannel) {
      throw new WebRTCError(
        'No connection established',
        WebRTCErrorCode.INVALID_STATE
      );
    }

    console.log(`[TRANSFER] Cancelling transfer of ${filename}`);
    const cancelMessage: CancelTransferMessage = {
      type: 'cancel-transfer',
      filename
    };

    dataChannel.send(JSON.stringify(cancelMessage));
    this.handleCancellation(filename);
  }

  async sendFile(dataChannel: RTCDataChannel, file: File) {
    if (!dataChannel) {
      const error = new WebRTCError(
        'No connection established',
        WebRTCErrorCode.INVALID_STATE
      );
      console.error('[TRANSFER] Error:', error);
      this.onError(error);
      throw error;
    }

    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    const abortController = new AbortController();
    this.transferAbortControllers[file.name] = abortController;
    this.activeTransfers.add(file.name);

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (!this.activeTransfers.has(file.name)) {
          console.log(`[TRANSFER] Transfer cancelled for ${file.name}`);
          return;
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        console.log(`[TRANSFER] Processing chunk ${i + 1}/${totalChunks}`);
        const arrayBuffer = await chunk.arrayBuffer();
        const chunkArray = new Uint8Array(arrayBuffer);
        
        let encryptedChunk;
        try {
          encryptedChunk = await this.encryptionService.encryptChunk(chunkArray);
        } catch (error) {
          throw new WebRTCError(
            'Failed to encrypt chunk',
            WebRTCErrorCode.ENCRYPTION_FAILED,
            error
          );
        }
        
        const base64 = btoa(String.fromCharCode(...encryptedChunk));

        const message: FileChunkMessage = {
          type: 'file-chunk',
          filename: file.name,
          chunk: base64,
          chunkIndex: i,
          totalChunks,
          fileSize: file.size
        };

        if (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
          console.log('[TRANSFER] Waiting for buffer to clear...');
          await new Promise(resolve => {
            dataChannel.onbufferedamountlow = () => {
              dataChannel.onbufferedamountlow = null;
              resolve(null);
            };
          });
        }

        dataChannel.send(JSON.stringify(message));
        console.log(`[TRANSFER] Sent chunk ${i + 1}/${totalChunks}`);

        if (this.onProgress) {
          const progress: TransferProgress = {
            filename: file.name,
            bytesTransferred: Math.min((i + 1) * CHUNK_SIZE, file.size),
            totalBytes: file.size,
            percent: ((i + 1) / totalChunks) * 100,
            type: 'upload'
          };
          this.onProgress(progress);
        }
      }
      console.log(`[TRANSFER] Completed sending ${file.name}`);
      this.activeTransfers.delete(file.name);
      delete this.transferAbortControllers[file.name];
    } catch (error) {
      this.activeTransfers.delete(file.name);
      delete this.transferAbortControllers[file.name];
      const webRTCError = error instanceof WebRTCError ? error : new WebRTCError(
        'Failed to send file',
        WebRTCErrorCode.TRANSFER_FAILED,
        error
      );
      console.error('[TRANSFER] Error:', webRTCError);
      this.onError(webRTCError);
      throw webRTCError;
    }
  }
}
