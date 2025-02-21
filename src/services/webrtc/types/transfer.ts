
export interface TransferStats {
  speed: number;  // Current speed in bytes/second
  averageSpeed: number;  // Average speed over the entire transfer
  startTime: number;  // Timestamp when transfer started
  estimatedTimeRemaining: number;  // Estimated seconds remaining
  pauseDuration: number;  // Total time spent paused
  retryCount: number;  // Number of retries attempted
  maxRetries: number;  // Maximum number of retries allowed
  lastPausedAt?: number;  // Timestamp of last pause
}

export interface TransferProgress {
  filename: string;
  currentChunk: number;
  totalChunks: number;
  loaded: number;
  total: number;
  status?: 'transferring' | 'canceled_by_sender' | 'canceled_by_receiver' | 'error' | 'paused';
  stats?: TransferStats;
}

export interface FileChunkMessage {
  type: 'file-chunk';
  filename: string;
  chunk?: string;
  chunkIndex?: number;
  totalChunks?: number;
  fileSize?: number;
  cancelled?: boolean;
  cancelledBy?: 'sender' | 'receiver';
}
