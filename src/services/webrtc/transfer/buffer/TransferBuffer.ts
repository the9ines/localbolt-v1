
export class TransferBuffer {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private activeTransfers: Set<string> = new Set();

  isTransferActive(filename: string): boolean {
    return this.activeTransfers.has(filename);
  }

  initializeTransfer(filename: string) {
    this.chunksBuffer[filename] = [];
    this.activeTransfers.add(filename);
  }

  storeChunk(filename: string, chunkIndex: number, chunk: Blob) {
    this.chunksBuffer[filename][chunkIndex] = chunk;
  }

  getStoredChunks(filename: string): Blob[] {
    return this.chunksBuffer[filename] || [];
  }

  completeTransfer(filename: string): Blob | null {
    const chunks = this.chunksBuffer[filename];
    if (!chunks) return null;

    const completeFile = new Blob(chunks);
    this.cleanupTransfer(filename);
    return completeFile;
  }

  cleanupTransfer(filename: string) {
    this.activeTransfers.delete(filename);
    delete this.chunksBuffer[filename];
  }
}
