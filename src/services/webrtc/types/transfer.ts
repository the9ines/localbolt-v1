
export type TransferStatus =
  | 'initializing'
  | 'transferring'
  | 'paused'
  | 'completed'
  | 'canceled_by_sender'
  | 'canceled_by_receiver'
  | 'error';

export interface TransferStats {
  speed: number;          // bytes per second
  averageSpeed: number;   // average bytes per second
  startTime: number;      // timestamp when transfer started
  estimatedTimeRemaining: number; // seconds
  pauseDuration: number;  // total time spent paused
  retryCount: number;     // number of retry attempts
}

export interface TransferProgress {
  filename: string;
  currentChunk: number;
  totalChunks: number;
  loaded: number;
  total: number;
  status: TransferStatus;
  stats?: TransferStats;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
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
  timestamp?: number;    // for calculating transfer speed
  retryCount?: number;   // for tracking retries
}
