
import { EncryptionError } from '@/types/webrtc-errors';
import { EncryptionService } from '../EncryptionService';

export class ChunkProcessor {
  constructor(private encryptionService: EncryptionService) {}

  private arrayToBase64(buffer: Uint8Array): string {
    // Process in smaller chunks to avoid call stack size exceeded
    const CHUNK_SIZE = 0xFFFF; // 65535 bytes
    let binary = '';
    
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      const chunk = buffer.slice(i, i + CHUNK_SIZE);
      binary += String.fromCharCode.apply(null, chunk);
    }
    
    return btoa(binary);
  }

  private base64ToArray(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async encryptChunk(data: Uint8Array): Promise<string> {
    try {
      console.log('[ENCRYPTION] Encrypting chunk');
      const encryptedData = await this.encryptionService.encryptChunk(data);
      return this.arrayToBase64(encryptedData);
    } catch (error) {
      console.error('[ENCRYPTION] Failed to encrypt chunk:', error);
      throw new EncryptionError("Failed to encrypt chunk", error);
    }
  }

  async decryptChunk(data: string): Promise<Blob> {
    try {
      const bytes = this.base64ToArray(data);
      const decryptedData = await this.encryptionService.decryptChunk(bytes);
      return new Blob([decryptedData]);
    } catch (error) {
      console.error('[ENCRYPTION] Failed to decrypt chunk:', error);
      throw new EncryptionError("Failed to decrypt chunk", error);
    }
  }
}
