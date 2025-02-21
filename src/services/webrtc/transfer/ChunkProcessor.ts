
import { EncryptionError } from '@/types/webrtc-errors';
import { EncryptionService } from '../EncryptionService';

export class ChunkProcessor {
  constructor(private encryptionService: EncryptionService) {}

  async encryptChunk(data: Uint8Array): Promise<string> {
    try {
      console.log('[ENCRYPTION] Encrypting chunk');
      // Convert to base64 before encryption to avoid recursion with large chunks
      const base64 = Buffer.from(data).toString('base64');
      const encrypted = await this.encryptionService.encrypt(base64);
      return encrypted;
    } catch (error) {
      console.error('[ENCRYPTION] Failed to encrypt chunk:', error);
      throw new EncryptionError("Failed to encrypt chunk", error);
    }
  }

  async decryptChunk(data: string): Promise<Blob> {
    try {
      const decrypted = await this.encryptionService.decrypt(data);
      // Convert back from base64 to binary
      const binary = Buffer.from(decrypted, 'base64');
      return new Blob([binary]);
    } catch (error) {
      console.error('[ENCRYPTION] Failed to decrypt chunk:', error);
      throw new EncryptionError("Failed to decrypt chunk", error);
    }
  }
}
