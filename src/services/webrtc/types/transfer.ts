
export interface TransferProgress {
  filename: string;
  currentChunk: number;
  totalChunks: number;
  loaded: number;
  total: number;
  speed?: number; // bytes per second
  estimatedTimeRemaining?: number; // in seconds
  status: TransferStatus;
}

export type TransferStatus = 
  | 'initializing'
  | 'transferring'
  | 'paused'
  | 'canceled_by_sender'
  | 'canceled_by_receiver'
  | 'error'
  | 'completed';

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
    code: TransferErrorCode;
    message: string;
  };
}
