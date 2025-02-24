
import { EncryptionService } from '../EncryptionService';
import { TransferError } from '@/types/webrtc-errors';
import { ChunkValidation } from '../types/transfer';

export class ChunkProcessor {
  private readonly chunkSize: number = 16384; // 16KB default chunk size

  constructor(private encryptionService: EncryptionService) {}

  async decryptChunk(chunk: string): Promise<Blob> {
    try {
      const encryptedChunk = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
      const decryptedChunk = await this.encryptionService.decryptChunk(encryptedChunk);
      return new Blob([decryptedChunk]);
    } catch (error) {
      throw new TransferError("Failed to decrypt chunk", error);
    }
  }

  async encryptChunk(chunk: Uint8Array): Promise<string> {
    try {
      const encryptedChunk = await this.encryptionService.encryptChunk(chunk);
      return btoa(String.fromCharCode(...encryptedChunk));
    } catch (error) {
      throw new TransferError("Failed to encrypt chunk", error);
    }
  }

  async validateChunk(chunk: Blob): Promise<ChunkValidation> {
    try {
      const arrayBuffer = await chunk.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return {
        isValid: true,
        checksum
      };
    } catch (error) {
      console.error('[VALIDATION] Chunk validation failed:', error);
      throw new TransferError("Failed to validate chunk", error);
    }
  }

  async calculateFileChecksum(chunks: Blob[]): Promise<string> {
    try {
      // Combine all chunks into a single blob
      const completeFile = new Blob(chunks);
      const arrayBuffer = await completeFile.arrayBuffer();
      
      // Calculate SHA-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('[VALIDATION] File checksum calculation failed:', error);
      throw new TransferError("Failed to calculate file checksum", error);
    }
  }

  getChunkSize(): number {
    return this.chunkSize;
  }
}
