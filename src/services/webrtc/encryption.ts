
import { box, randomBytes } from 'tweetnacl';

export class EncryptionService {
  constructor(
    private keyPair: { publicKey: Uint8Array; secretKey: Uint8Array },
    private remotePeerPublicKey: Uint8Array | null = null
  ) {}

  setRemotePeerPublicKey(publicKey: Uint8Array) {
    this.remotePeerPublicKey = publicKey;
  }

  async encryptChunk(chunk: Uint8Array): Promise<Uint8Array> {
    if (!this.remotePeerPublicKey) {
      console.error('[ENCRYPTION] No remote peer public key available');
      throw new Error('No remote peer public key');
    }
    const nonce = randomBytes(box.nonceLength);
    const encryptedChunk = box(
      chunk,
      nonce,
      this.remotePeerPublicKey,
      this.keyPair.secretKey
    );
    return new Uint8Array([...nonce, ...encryptedChunk]);
  }

  async decryptChunk(encryptedData: Uint8Array): Promise<Uint8Array> {
    if (!this.remotePeerPublicKey) {
      console.error('[ENCRYPTION] No remote peer public key available');
      throw new Error('No remote peer public key');
    }
    const nonce = encryptedData.slice(0, box.nonceLength);
    const encryptedChunk = encryptedData.slice(box.nonceLength);
    const decryptedChunk = box.open(
      encryptedChunk,
      nonce,
      this.remotePeerPublicKey,
      this.keyPair.secretKey
    );
    if (!decryptedChunk) {
      console.error('[ENCRYPTION] Failed to decrypt chunk');
      throw new Error('Failed to decrypt chunk');
    }
    return decryptedChunk;
  }

  getPublicKey(): Uint8Array {
    return this.keyPair.publicKey;
  }
}
