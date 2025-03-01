
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { WebRTCContext } from './context/WebRTCContext';
import { FileOperationsManager } from './file/FileOperationsManager';
import type { TransferProgress } from './types/transfer';

/**
 * Main WebRTCService that provides the public API for the WebRTC functionality.
 * This class delegates to the WebRTCContext and FileOperationsManager.
 */
class WebRTCService {
  private context: WebRTCContext;
  private fileManager: FileOperationsManager;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    
    this.context = new WebRTCContext(
      localPeerCode,
      onReceiveFile,
      onError,
      onProgress
    );
    
    this.fileManager = new FileOperationsManager(this.context);
  }

  /**
   * Initializes the WebRTC service, including setting up the signaling service
   * This must be called before using any other methods
   */
  public async initialize(): Promise<void> {
    await this.context.initialize();
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.context.setConnectionStateHandler(handler);
  }

  getRemotePeerCode(): string {
    return this.context.getRemotePeerCode();
  }

  async connect(remotePeerCode: string): Promise<void> {
    return this.context.connect(remotePeerCode);
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.fileManager.setProgressCallback(callback);
  }

  async sendFile(file: File) {
    await this.fileManager.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    this.fileManager.cancelTransfer(filename, isReceiver);
  }

  disconnect() {
    this.context.disconnect();
  }

  public pauseTransfer(filename: string): void {
    this.fileManager.pauseTransfer(filename);
  }

  public resumeTransfer(filename: string): void {
    this.fileManager.resumeTransfer(filename);
  }
}

export default WebRTCService;
