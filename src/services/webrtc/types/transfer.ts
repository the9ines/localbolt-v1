
export interface TransferStats {
  speed: number;
  averageSpeed: number;
  estimatedTimeRemaining: number;
  retryCount: number;
  maxRetries: number;
  startTime: number;
  pauseDuration: number;
  lastPausedAt?: number;
}

export interface TransferProgress {
  filename: string;
  currentChunk: number;
  totalChunks: number;
  loaded: number;
  total: number;
  status?: 'transferring' | 'paused' | 'canceled_by_sender' | 'canceled_by_receiver' | 'error';
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
  paused?: boolean;
  resumed?: boolean;
}
