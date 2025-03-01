
export interface TransferState {
  filename: string;
  total: number;
  file?: File;
  progress?: {
    loaded: number;
    total: number;
    currentChunk: number;
    totalChunks: number;
  };
}

export interface TransferControl {
  isPaused: boolean;
  isCancelled: boolean;
  currentTransfer: TransferState | null;
}

export interface TransferControlMessage {
  filename: string;
  isReceiver?: boolean;
}
