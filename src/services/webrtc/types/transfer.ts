
export type TransferStatus = 
  | 'initializing'
  | 'transferring'
  | 'paused'
  | 'completed'
  | 'error'
  | 'canceled_by_sender'
  | 'canceled_by_receiver';

export interface TransferStats {
  speed: number; // bytes per second
  averageSpeed: number;
  estimatedTimeRemaining: number; // in seconds
  startTime: number;
  pausedTime: number;
  resumeTime?: number;
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
  };
}

export interface FileChunkMessage {
  type: 'file-chunk' | 'transfer-control';
  filename: string;
  chunk?: string;
  chunkIndex?: number;
  totalChunks?: number;
  fileSize?: number;
  controlType?: 'cancel' | 'pause' | 'resume';
  cancelledBy?: 'sender' | 'receiver';
  error?: {
    code: string;
    message: string;
  };
}

export interface TransferState {
  [filename: string]: {
    chunks: Blob[];
    received: number;
    total: number;
    stats: TransferStats;
    status: TransferStatus;
  };
}
