
export type TransferStatus = 'initializing' | 'transferring' | 'completed' | 'error' | 'canceled_by_sender' | 'canceled_by_receiver';

export interface TransferProgress {
  filename: string;
  currentChunk: number;
  totalChunks: number;
  loaded: number;
  total: number;
  status?: TransferStatus;
  speed?: number;
  estimatedTimeRemaining?: number;
}

export interface FileChunkMessage {
  type: 'file-chunk' | 'transfer-control';
  filename: string;
  chunk?: string;
  chunkIndex?: number;
  totalChunks?: number;
  fileSize?: number;
  controlType?: 'cancel';
  cancelledBy?: 'sender' | 'receiver';
}
