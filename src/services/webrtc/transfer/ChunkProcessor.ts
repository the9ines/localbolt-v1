
import { EncryptionError } from '@/types/webrtc-errors';
import { EncryptionService } from '../EncryptionService';

export class ChunkProcessor {
  constructor(private encryptionService: EncryptionService) {}

  async encryptChunk(data: Uint8Array): Promise<string> {
    try {
      console.log('[ENCRYPTION] Encrypting chunk');
      const encryptedData = await this.encryptionService.encryptChunk(data);
      // Use browser's btoa for base64 encoding
      return btoa(String.fromCharCode.apply(null, encryptedData));
    } catch (error) {
      console.error('[ENCRYPTION] Failed to encrypt chunk:', error);
      throw new EncryptionError("Failed to encrypt chunk", error);
    }
  }

  async decryptChunk(data: string): Promise<Blob> {
    try {
      // Use browser's atob for base64 decoding
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decryptedData = await this.encryptionService.decryptChunk(bytes);
      return new Blob([decryptedData]);
    } catch (error) {
      console.error('[ENCRYPTION] Failed to decrypt chunk:', error);
      throw new EncryptionError("Failed to decrypt chunk", error);
    }
  }
}
