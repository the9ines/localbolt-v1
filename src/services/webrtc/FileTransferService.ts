import { TransferError } from '@/types/webrtc-errors';
import { EncryptionService } from './EncryptionService';

export interface TransferProgress {
  filename: string;
  currentChunk: number;
  totalChunks: number;
  loaded: number;
  total: number;
  status?: 'transferring' | 'canceled_by_sender' | 'canceled_by_receiver' | 'error';
}

export class FileTransferService {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private cancelTransfer: boolean = false;
  private activeTransfers: Set<string> = new Set();
  
  constructor(
    private dataChannel: RTCDataChannel,
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.setupDataChannel();
  }

  private setupDataChannel() {
    this.dataChannel.onmessage = async (event) => {
      try {
        const { type, filename, chunk, chunkIndex, totalChunks, fileSize, cancelled, cancelledBy } = JSON.parse(event.data);

        if (type === 'file-chunk') {
          if (cancelled) {
            console.log(`[TRANSFER] Transfer cancelled for ${filename} by ${cancelledBy}`);
            this.activeTransfers.delete(filename);
            delete this.chunksBuffer[filename];
            
            if (this.onProgress) {
              this.onProgress({
                filename,
                currentChunk: 0,
                totalChunks,
                loaded: 0,
                total: fileSize,
                status: cancelledBy === 'sender' ? 'canceled_by_sender' : 'canceled_by_receiver'
              });
            }
            return;
          }

          // If transfer was already cancelled by receiver, ignore incoming chunks
          if (!this.activeTransfers.has(filename)) {
            console.log(`[TRANSFER] Ignoring chunk for cancelled transfer: ${filename}`);
            return;
          }

          console.log(`[TRANSFER] Receiving chunk ${chunkIndex + 1}/${totalChunks} for ${filename}`);
          
          if (!this.chunksBuffer[filename]) {
            console.log(`[TRANSFER] Starting new transfer for ${filename}`);
            this.chunksBuffer[filename] = [];
            this.activeTransfers.add(filename);
          }

          try {
            const encryptedChunk = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
            const decryptedChunk = await this.encryptionService.decryptChunk(encryptedChunk);
            this.chunksBuffer[filename][chunkIndex] = new Blob([decryptedChunk]);

            const received = this.chunksBuffer[filename].filter(Boolean).length;
            if (this.onProgress) {
              this.onProgress({
                filename,
                currentChunk: received,
                totalChunks,
                loaded: received * (fileSize / totalChunks),
                total: fileSize,
                status: 'transferring'
              });
            }

            if (received === totalChunks) {
              console.log(`[TRANSFER] Completed transfer of ${filename}`);
              const file = new Blob(this.chunksBuffer[filename]);
              this.activeTransfers.delete(filename);
              delete this.chunksBuffer[filename];
              this.onReceiveFile(file, filename);
            }
          } catch (error) {
            this.activeTransfers.delete(filename);
            delete this.chunksBuffer[filename];
            if (this.onProgress) {
              this.onProgress({
                filename,
                currentChunk: 0,
                totalChunks,
                loaded: 0,
                total: fileSize,
                status: 'error'
              });
            }
            throw error;
          }
        }
      } catch (error) {
        console.error('[TRANSFER] Error processing message:', error);
        throw new TransferError("Failed to process received data", error);
      }
    };
  }

  cancelCurrentTransfer(filename: string, isReceiver: boolean = false) {
    console.log(`[TRANSFER] Cancelling transfer of ${filename} by ${isReceiver ? 'receiver' : 'sender'}`);
    this.cancelTransfer = true;
    this.activeTransfers.delete(filename);
    
    // Notify peer about cancellation
    const message = JSON.stringify({
      type: 'file-chunk',
      filename,
      cancelled: true,
      cancelledBy: isReceiver ? 'receiver' : 'sender'
    });
    this.dataChannel.send(message);
    
    // Clean up local buffer and update UI
    if (this.chunksBuffer[filename]) {
      const totalChunks = this.chunksBuffer[filename].length;
      delete this.chunksBuffer[filename];
      
      if (this.onProgress) {
        this.onProgress({
          filename,
          currentChunk: 0,
          totalChunks,
          loaded: 0,
          total: 0,
          status: isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender'
        });
      }
    }
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    this.cancelTransfer = false;

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (this.cancelTransfer) {
          console.log(`[TRANSFER] Transfer cancelled at chunk ${i + 1}/${totalChunks}`);
          throw new TransferError("Transfer cancelled by user");
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        console.log(`[TRANSFER] Processing chunk ${i + 1}/${totalChunks}`);
        const arrayBuffer = await chunk.arrayBuffer();
        const chunkArray = new Uint8Array(arrayBuffer);
        
        try {
          const encryptedChunk = await this.encryptionService.encryptChunk(chunkArray);
          const base64 = btoa(String.fromCharCode(...encryptedChunk));

          const message = JSON.stringify({
            type: 'file-chunk',
            filename: file.name,
            chunk: base64,
            chunkIndex: i,
            totalChunks,
            fileSize: file.size
          });

          if (this.dataChannel.bufferedAmount > this.dataChannel.bufferedAmountLowThreshold) {
            console.log('[TRANSFER] Waiting for buffer to clear');
            await new Promise(resolve => {
              this.dataChannel.onbufferedamountlow = () => {
                this.dataChannel.onbufferedamountlow = null;
                resolve(null);
              };
            });
          }

          this.dataChannel.send(message);
          console.log(`[TRANSFER] Sent chunk ${i + 1}/${totalChunks}`);

          if (this.onProgress) {
            this.onProgress({
              filename: file.name,
              currentChunk: i + 1,
              totalChunks,
              loaded: end,
              total: file.size,
              status: 'transferring'
            });
          }
        } catch (error) {
          throw new TransferError(
            "Failed to send file chunk",
            { chunkIndex: i, totalChunks, error }
          );
        }
      }
      console.log(`[TRANSFER] Completed sending ${file.name}`);
    } catch (error) {
      console.error('[TRANSFER] Error sending file:', error);
      throw error instanceof Error ? error : new TransferError("Failed to send file", error);
    }
  }
}
