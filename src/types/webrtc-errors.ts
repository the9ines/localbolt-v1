
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
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'TransferError';
  }
}

export class EncryptionError extends WebRTCError {
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'EncryptionError';
  }
}

// Enhanced error types
export class TimeoutError extends ConnectionError {
  constructor(message: string = 'Connection timed out', details?: any) {
    super(message, details);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends ConnectionError {
  constructor(message: string = 'Network connectivity issue', details?: any) {
    super(message, details);
    this.name = 'NetworkError';
  }
}

export class PeerConnectionError extends ConnectionError {
  constructor(message: string = 'Peer connection failed', details?: any) {
    super(message, details);
    this.name = 'PeerConnectionError';
  }
}

export class DataChannelError extends TransferError {
  constructor(message: string = 'Data channel error', details?: any) {
    super(message, details);
    this.name = 'DataChannelError';
  }
}

