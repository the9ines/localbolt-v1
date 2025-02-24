
import type { TransferProgress } from '../../types/transfer';
import { TransferStorageHandler } from '../handlers/TransferStorageHandler';

export class ProgressManager {
  private transferProgress: { [key: string]: TransferProgress } = {};
  
  constructor(
    private storageHandler: TransferStorageHandler,
    private onProgress?: (progress: TransferProgress) => void
  ) {}

  async updateProgress(
    filename: string,
    loaded: number,
    total: number,
    status: TransferProgress['status'] = 'transferring'
  ) {
    const progress: TransferProgress = {
      filename,
      currentChunk: 0,
      totalChunks: 0,
      loaded,
      total,
      status
    };

    this.transferProgress[filename] = progress;
    await this.storageHandler.saveProgress(this.transferProgress, {});

    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  getCurrentProgress(filename: string): TransferProgress {
    return this.transferProgress[filename] || {
      filename,
      currentChunk: 0,
      totalChunks: 0,
      loaded: 0,
      total: 0
    };
  }

  setProgress(progress: { [key: string]: TransferProgress }) {
    this.transferProgress = progress;
  }

  getProgress() {
    return this.transferProgress;
  }
}
