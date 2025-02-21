
import { EncryptionService } from '../EncryptionService';
import { TransferError, TransferErrorCode } from '@/types/webrtc-errors';

export class ChunkProcessor {
  private readonly MAX_CHUNK_SIZE = 16384; // 16KB

  constructor(private encryptionService: EncryptionService) {}

  private validateChunkSize(chunk: Uint8Array): void {
    if (chunk.length > this.MAX_CHUNK_SIZE) {
      throw new TransferError(
        `Chunk size ${chunk.length} bytes exceeds maximum allowed size of ${this.MAX_CHUNK_SIZE} bytes`,
        TransferErrorCode.FILE_TOO_LARGE
      );
    }
  }

  async encryptChunk(chunk: Uint8Array): Promise<string> {
    try {
      this.validateChunkSize(chunk);
      const encryptedChunk = await this.encryptionService.encryptChunk(chunk);
      return this.arrayBufferToBase64(new Uint8Array(encryptedChunk));
    } catch (error) {
      if (error instanceof TransferError) {
        throw error;
      }
      throw new TransferError(
        "Failed to encrypt chunk",
        TransferErrorCode.ENCRYPTION_ERROR,
        error
      );
    }
  }

  async decryptChunk(chunk: string): Promise<Blob> {
    try {
      const encryptedChunk = this.base64ToArrayBuffer(chunk);
      const decryptedChunk = await this.encryptionService.decryptChunk(encryptedChunk.buffer);
      return new Blob([new Uint8Array(decryptedChunk)]);
    } catch (error) {
      throw new TransferError(
        "Failed to decrypt chunk",
        TransferErrorCode.DECRYPTION_ERROR,
        error
      );
    }
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    try {
      return btoa(String.fromCharCode(...buffer));
    } catch (error) {
      throw new TransferError(
        "Failed to encode chunk to base64",
        TransferErrorCode.INVALID_CHUNK,
        error
      );
    }
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    try {
      const binary = atob(base64);
      return Uint8Array.from(binary, char => char.charCodeAt(0));
    } catch (error) {
      throw new TransferError(
        "Failed to decode base64 chunk",
        TransferErrorCode.INVALID_CHUNK,
        error
      );
    }
  }
}
