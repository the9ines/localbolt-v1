
import type { TransferProgress } from '../../types/transfer';

export class TransferStorageHandler {
  private readonly PROGRESS_STORAGE_KEY = 'transfer_progress';
  private readonly CHUNKS_STORAGE_KEY = 'transfer_chunks';

  loadSavedProgress(): { 
    progress: { [key: string]: TransferProgress },
    chunks: { [key: string]: Blob[] }
  } {
    try {
      const savedProgress = localStorage.getItem(this.PROGRESS_STORAGE_KEY);
      const savedChunks = localStorage.getItem(this.CHUNKS_STORAGE_KEY);
      
      const progress: { [key: string]: TransferProgress } = savedProgress 
        ? JSON.parse(savedProgress)
        : {};
      
      const chunks: { [key: string]: Blob[] } = {};
      
      if (savedChunks) {
        const parsedChunks = JSON.parse(savedChunks);
        Object.keys(parsedChunks).forEach(filename => {
          chunks[filename] = parsedChunks[filename].map((chunk: string) => 
            new Blob([Uint8Array.from(atob(chunk), c => c.charCodeAt(0))])
          );
        });
      }

      return { progress, chunks };
    } catch (error) {
      console.error('[STORAGE] Failed to load saved progress:', error);
      localStorage.removeItem(this.PROGRESS_STORAGE_KEY);
      localStorage.removeItem(this.CHUNKS_STORAGE_KEY);
      return { progress: {}, chunks: {} };
    }
  }

  async saveProgress(
    progress: { [key: string]: TransferProgress },
    chunks: { [key: string]: Blob[] }
  ): Promise<void> {
    try {
      localStorage.setItem(this.PROGRESS_STORAGE_KEY, JSON.stringify(progress));
      
      const chunksToStore: { [key: string]: string[] } = {};
      for (const [filename, blobs] of Object.entries(chunks)) {
        chunksToStore[filename] = [];
        for (const blob of blobs) {
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          chunksToStore[filename].push(base64);
        }
      }
      
      localStorage.setItem(this.CHUNKS_STORAGE_KEY, JSON.stringify(chunksToStore));
    } catch (error) {
      console.error('[STORAGE] Failed to save progress:', error);
    }
  }

  clearStorage(): void {
    localStorage.removeItem(this.PROGRESS_STORAGE_KEY);
    localStorage.removeItem(this.CHUNKS_STORAGE_KEY);
  }
}
