
import { box, randomBytes } from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { EncryptionError } from '@/types/webrtc-errors';

export class EncryptionService {
  private keyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  private remotePeerPublicKey: Uint8Array | null = null;

  constructor() {
    this.keyPair = box.keyPair();
  }

  getPublicKey(): string {
    return encodeBase64(this.keyPair.publicKey);
  }

  setRemotePublicKey(publicKeyBase64: string) {
    try {
      this.remotePeerPublicKey = decodeBase64(publicKeyBase64);
      console.log('[ENCRYPTION] Set remote public key:', publicKeyBase64);
    } catch (error) {
      console.error('[ENCRYPTION] Invalid public key format:', error);
      throw new EncryptionError("Invalid public key format", error);
    }
  }

  async encryptChunk(chunk: Uint8Array): Promise<Uint8Array> {
    console.log('[ENCRYPTION] Encrypting chunk');
    if (!this.remotePeerPublicKey) {
      throw new EncryptionError("No remote peer public key available");
    }
    
    try {
      const nonce = randomBytes(box.nonceLength);
      const encryptedChunk = box(
        chunk,
        nonce,
        this.remotePeerPublicKey,
        this.keyPair.secretKey
      );

      if (!encryptedChunk) {
        throw new EncryptionError("Encryption failed");
      }

      return new Uint8Array([...nonce, ...encryptedChunk]);
    } catch (error) {
      console.error('[ENCRYPTION] Encryption failed:', error);
      throw new EncryptionError("Failed to encrypt chunk", error);
    }
  }

  async decryptChunk(encryptedData: Uint8Array): Promise<Uint8Array> {
    console.log('[ENCRYPTION] Decrypting chunk');
    if (!this.remotePeerPublicKey) {
      throw new EncryptionError("No remote peer public key available");
    }
    
    try {
      const nonce = encryptedData.slice(0, box.nonceLength);
      const encryptedChunk = encryptedData.slice(box.nonceLength);
      const decryptedChunk = box.open(
        encryptedChunk,
        nonce,
        this.remotePeerPublicKey,
        this.keyPair.secretKey
      );
      
      if (!decryptedChunk) {
        throw new EncryptionError("Decryption failed");
      }
      
      return decryptedChunk;
    } catch (error) {
      console.error('[ENCRYPTION] Decryption failed:', error);
      throw new EncryptionError("Failed to decrypt chunk", error);
    }
  }

  reset() {
    console.log('[ENCRYPTION] Resetting encryption service');
    this.keyPair = box.keyPair();
    this.remotePeerPublicKey = null;
  }
}
