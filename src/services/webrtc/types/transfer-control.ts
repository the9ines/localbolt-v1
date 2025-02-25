
export interface TransferState {
  filename: string;
  total: number;
  sessionId?: string;  // Add session tracking
  file?: File;
  progress?: {
    loaded: number;
    total: number;
    currentChunk: number;
    totalChunks: number;
    lastUpdated?: number; // For debouncing
  };
  retryInfo?: {
    attempts: number;
    lastRetryTime: number;
    backoffDelay: number;
  };
}

export interface TransferControl {
  isPaused: boolean;
  isCancelled: boolean;
  currentTransfer: TransferState | null;
  activeSessionId?: string;  // Track current session
}

export interface TransferControlMessage {
  filename: string;
  sessionId?: string;  // Include session ID in messages
  isReceiver?: boolean;
}
