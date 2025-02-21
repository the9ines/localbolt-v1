
import { EncryptionService } from '../EncryptionService';
import { TransferError } from '@/types/webrtc-errors';

export class ChunkProcessor {
  constructor(private encryptionService: EncryptionService) {}

  async decryptChunk(chunk: string): Promise<Blob> {
    try {
      if (!chunk) {
        throw new TransferError(
          "Invalid chunk received",
          TransferError.Codes.INVALID_CHUNK,
          { chunk }
        );
      }

      const encryptedChunk = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
      const decryptedChunk = await this.encryptionService.decryptChunk(encryptedChunk);
      
      if (!decryptedChunk || decryptedChunk.length === 0) {
        throw new TransferError(
          "Decryption produced empty chunk",
          TransferError.Codes.ENCRYPTION,
          { originalLength: chunk.length }
        );
      }

      return new Blob([decryptedChunk]);
    } catch (error) {
      if (error instanceof TransferError) {
        throw error;
      }
      throw new TransferError(
        "Failed to decrypt chunk",
        TransferError.Codes.CHUNK_PROCESSING,
        error
      );
    }
  }

  async encryptChunk(chunk: Uint8Array): Promise<string> {
    try {
      if (!chunk || chunk.length === 0) {
        throw new TransferError(
          "Invalid chunk provided for encryption",
          TransferError.Codes.INVALID_CHUNK,
          { chunkLength: chunk?.length }
        );
      }

      const encryptedChunk = await this.encryptionService.encryptChunk(chunk);
      
      if (!encryptedChunk || encryptedChunk.length === 0) {
        throw new TransferError(
          "Encryption produced empty chunk",
          TransferError.Codes.ENCRYPTION,
          { originalLength: chunk.length }
        );
      }

      return btoa(String.fromCharCode(...encryptedChunk));
    } catch (error) {
      if (error instanceof TransferError) {
        throw error;
      }
      throw new TransferError(
        "Failed to encrypt chunk",
        TransferError.Codes.CHUNK_PROCESSING,
        error
      );
    }
  }
}
