
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
    this.remotePeerPublicKey = decodeBase64(publicKeyBase64);
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
      return new Uint8Array([...nonce, ...encryptedChunk]);
    } catch (error) {
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
      throw new EncryptionError("Failed to decrypt chunk", error);
    }
  }

  reset() {
    this.remotePeerPublicKey = null;
  }
}
