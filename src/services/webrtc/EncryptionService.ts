
export class EncryptionService {
  async encrypt(data: ArrayBuffer): Promise<ArrayBuffer> {
    // For now, return the data as-is
    // In a real implementation, this would use proper encryption
    return data;
  }

  async decrypt(data: ArrayBuffer): Promise<ArrayBuffer> {
    // For now, return the data as-is
    // In a real implementation, this would use proper decryption
    return data;
  }
}
