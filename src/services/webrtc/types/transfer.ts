
export interface DataChannelHandler {
  onFileReceive: (file: Blob, filename: string) => void;
  onProgress: (progress: TransferProgress) => void;
  onError: (error: Error) => void;
}

export interface TransferProgress {
  filename: string;
  total: number;
  loaded: number;
  currentChunk?: number;
  totalChunks?: number;
  sending: boolean;
  status: 'transferring' | 'paused' | 'completed' | 'canceled_by_sender' | 'canceled_by_receiver' | 'error';
  stats?: {
    speed: number;
    averageSpeed: number;
    estimatedTimeRemaining: number;
    retryCount: number;
    maxRetries: number;
  };
}

export interface FileChunkMessage {
  type: 'chunk';  // Keep consistent type
  filename: string;
  chunk: Uint8Array | string;  // Allow both types for flexibility
  chunkIndex: number;
  totalChunks: number;
  fileSize: number;
  cancelled?: boolean;
  cancelledBy?: 'sender' | 'receiver';
  paused?: boolean;
  resumed?: boolean;
}
