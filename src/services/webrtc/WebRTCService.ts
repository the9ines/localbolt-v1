
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './types/transfer';
import { ServiceCoordinator } from './ServiceCoordinator';

class WebRTCService {
  private coordinator: ServiceCoordinator;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    this.coordinator = new ServiceCoordinator(
      localPeerCode,
      onReceiveFile,
      onError,
      onProgress
    );
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.coordinator.setConnectionStateHandler(handler);
  }

  async connect(remotePeerCode: string): Promise<void> {
    return this.coordinator.connect(remotePeerCode);
  }

  disconnect() {
    this.coordinator.disconnect();
  }

  async sendFile(file: File) {
    await this.coordinator.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    this.coordinator.cancelTransfer(filename, isReceiver);
  }

  pauseTransfer(filename: string): void {
    this.coordinator.pauseTransfer(filename);
  }

  resumeTransfer(filename: string): void {
    this.coordinator.resumeTransfer(filename);
  }

  getRemotePeerCode(): string {
    return this.coordinator['sessionManager'].getRemotePeerCode();
  }
}

export default WebRTCService;
