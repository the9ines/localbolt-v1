
export enum TransferErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_CHUNK = 'INVALID_CHUNK',
  MISSING_CHUNKS = 'MISSING_CHUNKS',
  TRANSFER_CANCELLED = 'TRANSFER_CANCELLED',
  CHANNEL_ERROR = 'CHANNEL_ERROR',
  MESSAGE_ERROR = 'MESSAGE_ERROR',
  CHUNK_ERROR = 'CHUNK_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  CHANNEL_NOT_READY = 'CHANNEL_NOT_READY'
}

export class WebRTCError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'WebRTCError';
  }
}

export class ConnectionError extends WebRTCError {
  constructor(message: string, code?: string, details?: any) {
    super(message, code, details);
    this.name = 'ConnectionError';
  }
}

export class SignalingError extends WebRTCError {
  constructor(message: string, code?: string, details?: any) {
    super(message, code, details);
    this.name = 'SignalingError';
  }
}

export class TransferError extends WebRTCError {
  constructor(message: string, public code: TransferErrorCode, details?: any) {
    super(message, code, details);
    this.name = 'TransferError';
  }
}

export class EncryptionError extends WebRTCError {
  constructor(message: string, code?: string, details?: any) {
    super(message, code, details);
    this.name = 'EncryptionError';
  }
}
