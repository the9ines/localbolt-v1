
import { EncryptionService } from '../EncryptionService';
import { TransferError } from '@/types/webrtc-errors';

export class ChunkProcessor {
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
}
