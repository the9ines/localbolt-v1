
export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  from: string;
  to: string;
}

export interface FileChunkMessage {
  type: 'file-chunk';
  filename: string;
  chunk: string;
  chunkIndex: number;
  totalChunks: number;
  fileSize: number;
}

export interface TransferProgress {
  filename: string;
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
  type: 'upload' | 'download';
}

export class WebRTCError extends Error {
  constructor(
    message: string,
    public code: WebRTCErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'WebRTCError';
  }
}

export enum WebRTCErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  TRANSFER_FAILED = 'TRANSFER_FAILED',
  INVALID_STATE = 'INVALID_STATE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PEER_DISCONNECTED = 'PEER_DISCONNECTED',
  SIGNALING_FAILED = 'SIGNALING_FAILED'
}
