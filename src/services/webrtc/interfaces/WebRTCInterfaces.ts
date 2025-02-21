
import { TransferProgress } from '../types/transfer';
import { WebRTCError } from '@/types/webrtc-errors';

export interface IWebRTCService {
  connectToPeer: (peerId: string) => Promise<void>;
  disconnect: () => void;
  isConnected: () => boolean;
  sendFile: (file: File) => Promise<void>;
  cancelTransfer: (filename: string, isReceiver?: boolean) => void;
  setProgressCallback: (callback: (progress: TransferProgress) => void) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback: (...args: any[]) => void) => void;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export interface WebRTCCallbacks {
  onReceiveFile: (file: Blob, filename: string) => void;
  onError: (error: WebRTCError) => void;
}
