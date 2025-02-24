
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
  sending: boolean;
  status?: 'transferring' | 'paused' | 'canceled_by_sender' | 'canceled_by_receiver' | 'error';
  stats?: TransferStats;
}

export type FileChunkMessageType = 'file-chunk';

export interface FileChunkMessage {
  type: FileChunkMessageType;
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
