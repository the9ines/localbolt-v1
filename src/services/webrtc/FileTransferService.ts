
import { TransferError } from '@/types/webrtc-errors';
import { EncryptionService } from './EncryptionService';

export class FileTransferService {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  
  constructor(
    private dataChannel: RTCDataChannel,
    private encryptionService: EncryptionService,
    private onReceiveFile: (file: Blob, filename: string) => void
  ) {
    this.setupDataChannel();
  }

  private setupDataChannel() {
    this.dataChannel.onmessage = async (event) => {
      try {
        const { type, filename, chunk, chunkIndex, totalChunks } = JSON.parse(event.data);

        if (type === 'file-chunk') {
          console.log(`[TRANSFER] Receiving chunk ${chunkIndex + 1}/${totalChunks} for ${filename}`);
          
          if (!this.chunksBuffer[filename]) {
            console.log(`[TRANSFER] Starting new transfer for ${filename}`);
            this.chunksBuffer[filename] = [];
          }

          try {
            const encryptedChunk = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
            const decryptedChunk = await this.encryptionService.decryptChunk(encryptedChunk);
            this.chunksBuffer[filename][chunkIndex] = new Blob([decryptedChunk]);

            if (this.chunksBuffer[filename].filter(Boolean).length === totalChunks) {
              console.log(`[TRANSFER] Completed transfer of ${filename}`);
              const file = new Blob(this.chunksBuffer[filename]);
              delete this.chunksBuffer[filename];
              this.onReceiveFile(file, filename);
            }
          } catch (error) {
            delete this.chunksBuffer[filename];
            throw error;
          }
        }
      } catch (error) {
        console.error('[TRANSFER] Error processing message:', error);
        throw new TransferError("Failed to process received data", error);
      }
    };
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      for (let i = 0; i < totalChunks; i++) {
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
