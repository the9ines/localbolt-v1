
export class WebRTCError extends Error {
  constructor(
    message: string, 
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WebRTCError';
  }
}

export class ConnectionError extends WebRTCError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

export class SignalingError extends WebRTCError {
  constructor(message: string, details?: any) {
    super(message, 'SIGNALING_ERROR', details);
    this.name = 'SignalingError';
  }
}

export class TransferError extends WebRTCError {
  static Codes = {
    CHUNK_PROCESSING: 'TRANSFER_CHUNK_PROCESSING',
    ENCRYPTION: 'TRANSFER_ENCRYPTION',
    BUFFER_OVERFLOW: 'TRANSFER_BUFFER_OVERFLOW',
    INVALID_CHUNK: 'TRANSFER_INVALID_CHUNK',
    CANCELED: 'TRANSFER_CANCELED',
    TIMEOUT: 'TRANSFER_TIMEOUT',
  };

  constructor(message: string, code: string, details?: any) {
    super(message, code, details);
    this.name = 'TransferError';
  }
}

export class EncryptionError extends WebRTCError {
  constructor(message: string, details?: any) {
    super(message, 'ENCRYPTION_ERROR', details);
    this.name = 'EncryptionError';
  }
}
