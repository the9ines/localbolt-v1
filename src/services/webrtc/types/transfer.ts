
export interface TransferProgress {
  filename: string;
  currentChunk: number;
  totalChunks: number;
  loaded: number;
  total: number;
  status?: 'initializing' | 'transferring' | 'completed' | 'error' | 'canceled_by_sender' | 'canceled_by_receiver';
}
