
import { EncryptionError } from '@/types/webrtc-errors';
import { EncryptionService } from '../EncryptionService';

export class ChunkProcessor {
  constructor(private encryptionService: EncryptionService) {}

  async encryptChunk(data: Uint8Array): Promise<string> {
    try {
      console.log('[ENCRYPTION] Encrypting chunk');
      // Convert chunk to base64 before encryption to handle large chunks
      const encryptedData = await this.encryptionService.encryptChunk(data);
      return Buffer.from(encryptedData).toString('base64');
    } catch (error) {
      console.error('[ENCRYPTION] Failed to encrypt chunk:', error);
      throw new EncryptionError("Failed to encrypt chunk", error);
    }
  }

  async decryptChunk(data: string): Promise<Blob> {
    try {
      // Convert base64 back to Uint8Array for decryption
      const binaryData = Uint8Array.from(Buffer.from(data, 'base64'));
      const decryptedData = await this.encryptionService.decryptChunk(binaryData);
      return new Blob([decryptedData]);
    } catch (error) {
      console.error('[ENCRYPTION] Failed to decrypt chunk:', error);
      throw new EncryptionError("Failed to decrypt chunk", error);
    }
  }
}
