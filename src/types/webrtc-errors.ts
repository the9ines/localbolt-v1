
export class WebRTCError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'WebRTCError';
  }
}

export class ConnectionError extends WebRTCError {
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'ConnectionError';
  }
}

export class SignalingError extends WebRTCError {
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'SignalingError';
  }
}

export class TransferError extends WebRTCError {
  code: TransferErrorCode;
  
  constructor(message: string, code: TransferErrorCode, details?: any) {
    super(message, details);
    this.name = 'TransferError';
    this.code = code;
  }
}

export class EncryptionError extends WebRTCError {
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'EncryptionError';
  }
}

export enum TransferErrorCode {
  CHUNK_ENCRYPTION_FAILED = 'CHUNK_ENCRYPTION_FAILED',
  CHUNK_DECRYPTION_FAILED = 'CHUNK_DECRYPTION_FAILED',
  TRANSFER_CANCELLED = 'TRANSFER_CANCELLED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  BUFFER_OVERFLOW = 'BUFFER_OVERFLOW',
  INVALID_CHUNK = 'INVALID_CHUNK',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  MISSING_CHUNKS = 'MISSING_CHUNKS',
}
