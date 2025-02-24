
import type { TransferProgress } from '../../types/transfer';
import { ChunkProcessor } from '../ChunkProcessor';

export class ChunkHandler {
  constructor(private chunkProcessor: ChunkProcessor) {}

  async processChunk(
    chunk: string,
    chunkIndex: number,
    chunksBuffer: Blob[],
    fileSize: number,
    totalChunks: number
  ): Promise<{
    processed: Blob,
    received: number
  }> {
    const decryptedChunk = await this.chunkProcessor.decryptChunk(chunk);
    await this.chunkProcessor.validateChunk(decryptedChunk);
    
    chunksBuffer[chunkIndex] = decryptedChunk;
    const received = chunksBuffer.filter(Boolean).length;
    
    return {
      processed: decryptedChunk,
      received
    };
  }

  async finalizeFile(chunks: Blob[]): Promise<{
    file: Blob,
    checksum: string
  }> {
    const checksum = await this.chunkProcessor.calculateFileChecksum(chunks);
    const completeFile = new Blob(chunks);
    return { file: completeFile, checksum };
  }
}
