
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { SignalingHandler } from './SignalingHandler';
import { DataChannelManager } from './DataChannelManager';
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCRetryHandler } from './WebRTCRetryHandler';
import { ConnectionService } from './ConnectionService';
import { TransferService } from './TransferService';
import type { TransferProgress } from './types/transfer';

class WebRTCService {
  private connectionService: ConnectionService;
  private transferService: TransferService;
  private connectionManager: ConnectionManager;
  private signalingHandler: SignalingHandler;
  private dataChannelManager: DataChannelManager;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private eventManager: WebRTCEventManager;
  private retryHandler: WebRTCRetryHandler;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    
    this.encryptionService = new EncryptionService();
    this.initializeServices();
    this.retryHandler = new WebRTCRetryHandler(this.onError, this.connect.bind(this));
  }

  private initializeServices() {
    this.dataChannelManager = new DataChannelManager(
      this.encryptionService,
      this.onReceiveFile,
      this.onProgress || (() => {}),
      this.handleError.bind(this)
    );

    this.connectionManager = new ConnectionManager(
      (candidate) => {
        this.signalingService.sendSignal('ice-candidate', candidate, this.getRemotePeerCode())
          .catch(error => {
            console.error('[ICE] Failed to send candidate:', error);
            this.handleError(error as WebRTCError);
          });
      },
      this.handleError.bind(this),
      (channel) => this.dataChannelManager.setupDataChannel(channel)
    );

    this.signalingService = new SignalingService(
      this.localPeerCode,
      this.handleSignal.bind(this)
    );

    this.signalingHandler = new SignalingHandler(
      this.connectionManager,
      this.encryptionService,
      this.signalingService,
      this.localPeerCode,
      (channel) => this.dataChannelManager.setupDataChannel(channel)
    );

    this.eventManager = new WebRTCEventManager(
      this.connectionManager,
      this.dataChannelManager,
      this.handleError.bind(this)
    );

    this.connectionService = new ConnectionService(
      this.connectionManager,
      this.signalingService,
      this.encryptionService,
      this.dataChannelManager,
      this.localPeerCode
    );

    this.transferService = new TransferService(
      this.dataChannelManager,
      this.onProgress
    );
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.eventManager.setConnectionStateListener(handler);
  }

  private handleError(error: WebRTCError) {
    this.retryHandler.handleError(error, this.getRemotePeerCode());
  }

  getRemotePeerCode(): string {
    return this.connectionService.getRemotePeerCode();
  }

  async connect(remotePeerCode: string): Promise<void> {
    await this.connectionService.connect(remotePeerCode);
    this.retryHandler.resetAttempts();
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.transferService.setProgressCallback(callback);
  }

  async sendFile(file: File) {
    await this.transferService.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    this.transferService.cancelTransfer(filename, isReceiver);
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting');
    this.eventManager.handleDisconnect();
    this.dataChannelManager.disconnect();
    this.connectionService.disconnect();
    this.retryHandler.resetAttempts();
  }

  pauseTransfer(filename: string): void {
    this.transferService.pauseTransfer(filename);
  }

  resumeTransfer(filename: string): void {
    this.transferService.resumeTransfer(filename);
  }

  private readonly handleSignal = async (signal: SignalData) => {
    await this.signalingHandler.handleSignal(signal);
  };
}

export default WebRTCService;
