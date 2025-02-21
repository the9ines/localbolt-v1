
export interface TransferProgress {
  filename: string;
  currentChunk: number;
  totalChunks: number;
  loaded: number;
  total: number;
  status?: 'transferring' | 'paused' | 'canceled_by_sender' | 'canceled_by_receiver' | 'error';
  stats?: {
    speed: number;
    averageSpeed: number;
    estimatedTimeRemaining: number;
    retryCount: number;
    maxRetries: number;
  };
}
