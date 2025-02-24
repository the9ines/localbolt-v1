
export interface DataChannelHandler {
  onFileReceive: (file: Blob, filename: string) => void;
  onProgress: (progress: TransferProgress) => void;
  onError: (error: Error) => void;
}

export interface TransferProgress {
  filename: string;
  total: number;
  received: number;
  sending: boolean;
  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'error';
}
