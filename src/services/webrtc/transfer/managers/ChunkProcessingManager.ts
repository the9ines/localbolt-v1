
import { ChunkHandler } from '../handlers/ChunkHandler';
import { RetryHandler } from '../handlers/RetryHandler';
import type { TransferProgress } from '../../types/transfer';

export class ChunkProcessingManager {
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private processingPromises: { [key: string]: Promise<void>[] } = {};
  private readonly MAX_PARALLEL_CHUNKS = 3;

  constructor(
    private chunkHandler: ChunkHandler,
    private retryHandler: RetryHandler,
    private onProgress?: (filename: string, loaded: number, total: number, status: TransferProgress['status']) => void
  ) {}

  async processChunk(
    filename: string,
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
    fileSize: number
  ): Promise<{ file: Blob | null; received: number }> {
    if (!this.chunksBuffer[filename]) {
      this.chunksBuffer[filename] = new Array(totalChunks);
      this.processingPromises[filename] = [];
    }

    // Clean up completed promises
    this.processingPromises[filename] = this.processingPromises[filename].filter(p => p !== Promise.resolve());

    // Wait if we've reached max parallel processing
    while (this.processingPromises[filename].length >= this.MAX_PARALLEL_CHUNKS) {
      await Promise.race(this.processingPromises[filename]);
    }

    const processPromise = this.processChunkWithRetry(filename, chunk, chunkIndex, totalChunks, fileSize);
    const voidPromise: Promise<void> = processPromise.then(() => {});
    this.processingPromises[filename].push(voidPromise);
    
    return processPromise;
  }

  private async processChunkWithRetry(
    filename: string,
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
    fileSize: number
  ): Promise<{ file: Blob | null; received: number }> {
    const chunkKey = `${filename}-${chunkIndex}`;

    const received = await this.retryHandler.executeWithRetry(
      chunkKey,
      async () => {
        const { received } = await this.chunkHandler.processChunk(
          chunk,
          chunkIndex,
          this.chunksBuffer[filename],
          fileSize,
          totalChunks
        );
        return received;
      },
      (attempt, delay) => {
        console.log(`[RETRY] Attempt ${attempt} for chunk ${chunkIndex} of ${filename}, next retry in ${delay}ms`);
      }
    );

    if (this.onProgress) {
      this.onProgress(filename, received * (fileSize / totalChunks), fileSize, 'transferring');
    }

    if (received === totalChunks) {
      const { file, checksum } = await this.chunkHandler.finalizeFile(this.chunksBuffer[filename]);
      this.cleanup(filename);
      return { file, received };
    }

    return { file: null, received };
  }

  cleanup(filename: string) {
    delete this.chunksBuffer[filename];
    delete this.processingPromises[filename];
  }

  setChunksBuffer(chunks: { [key: string]: Blob[] }) {
    this.chunksBuffer = chunks;
  }
}
