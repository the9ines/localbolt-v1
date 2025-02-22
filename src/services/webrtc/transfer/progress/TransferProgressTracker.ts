
import type { TransferProgress } from '../../types/transfer';

export class TransferProgressTracker {
  private transferProgress: { [key: string]: TransferProgress } = {};
  
  constructor(private onProgress?: (progress: TransferProgress) => void) {}

  getCurrentProgress(filename: string): TransferProgress {
    return this.transferProgress[filename] || {
      filename,
      currentChunk: 0,
      totalChunks: 0,
      loaded: 0,
      total: 0
    };
  }

  updateProgress(
    filename: string,
    currentChunk: number,
    totalChunks: number,
    loaded: number,
    total: number,
    status: TransferProgress['status'] = 'transferring'
  ) {
    console.log('[TRANSFER-PROGRESS] Updating progress:', {
      filename,
      currentChunk,
      totalChunks,
      loaded,
      total,
      status
    });

    const progress: TransferProgress = {
      filename,
      currentChunk,
      totalChunks,
      loaded,
      total,
      status
    };

    this.transferProgress[filename] = progress;

    if (this.onProgress) {
      console.log('[TRANSFER-PROGRESS] Emitting progress update');
      this.onProgress(progress);
    }
  }

  clearProgress(filename: string) {
    delete this.transferProgress[filename];
  }
}
