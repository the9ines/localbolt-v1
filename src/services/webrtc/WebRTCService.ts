import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { SignalingHandler } from './SignalingHandler';
import { DataChannelManager } from './DataChannelManager';
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCRetryHandler } from './WebRTCRetryHandler';
import { ConnectionInitializer } from './connection/ConnectionInitializer';
import { ConnectionMonitor } from './connection/ConnectionMonitor';
import type { TransferProgress } from './types/transfer';

class WebRTCService {
  private remotePeerCode: string = '';
  private connectionManager: ConnectionManager;
  private signalingHandler: SignalingHandler;
  private dataChannelManager: DataChannelManager;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private eventManager: WebRTCEventManager;
  private retryHandler: WebRTCRetryHandler;
  private connectionInitializer: ConnectionInitializer;
  private connectionMonitor: ConnectionMonitor;
  private onProgressCallback?: (progress: TransferProgress) => void;
  private isTransferInProgress: boolean = false;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    
    this.encryptionService = new EncryptionService();
    this.onProgressCallback = onProgress;
    
    this.initializeServices();
    this.retryHandler = new WebRTCRetryHandler(this.onError, this.connect.bind(this));
    
    this.connectionMonitor = new ConnectionMonitor(
      this.connectionManager,
      this.onError,
      () => this.handleDisconnectDuringTransfer()
    );
    this.connectionMonitor.startMonitoring(this.isTransferInProgress);
  }

  private handleDisconnectDuringTransfer() {
    if (this.isTransferInProgress) {
      console.log('[CONNECTION-CHECK] Attempting to recover transfer connection');
      this.retryHandler.resetAttempts();
      this.connect(this.remotePeerCode).catch(error => {
        console.error('[CONNECTION-CHECK] Failed to recover connection:', error);
        this.onError(new ConnectionError("Connection lost during transfer", { state: 'disconnected' }));
      });
    }
  }

  private initializeServices() {
    this.connectionManager = new ConnectionManager(
      (candidate) => {
        this.signalingService.sendSignal('ice-candidate', candidate, this.remotePeerCode)
          .catch(error => {
            console.error('[ICE] Failed to send candidate:', error);
            this.handleError(error as WebRTCError);
          });
      },
      this.handleError.bind(this),
      (channel) => this.dataChannelManager.setupDataChannel(channel)
    );

    this.dataChannelManager = new DataChannelManager(
      this.encryptionService,
      this.onReceiveFile,
      (progress) => {
        if (this.onProgressCallback) {
          this.onProgressCallback(progress);
        }
      },
      this.handleError.bind(this)
    );

    this.signalingService = new SignalingService(this.localPeerCode, this.handleSignal.bind(this));
    
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

    this.connectionInitializer = new ConnectionInitializer(
      this.connectionManager,
      this.dataChannelManager,
      this.signalingService,
      this.encryptionService,
      this.localPeerCode
    );
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.eventManager.setConnectionStateListener(handler);
  }

  private handleError(error: WebRTCError) {
    this.retryHandler.handleError(error, this.remotePeerCode);
  }

  getRemotePeerCode(): string {
    return this.signalingHandler.getRemotePeerCode();
  }

  async connect(remotePeerCode: string): Promise<void> {
    this.remotePeerCode = remotePeerCode;
    try {
      await this.connectionInitializer.initializeConnection(remotePeerCode);
    } catch (error) {
      this.disconnect();
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    }
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.onProgressCallback = callback;
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    this.isTransferInProgress = true;
    try {
      await this.dataChannelManager.sendFile(file);
    } catch (error) {
      throw error;
    } finally {
      this.isTransferInProgress = false;
    }
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    console.log('[WEBRTC] Cancelling transfer:', filename);
    this.isTransferInProgress = false;
    this.dataChannelManager.cancelTransfer(filename, isReceiver);
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting');
    this.isTransferInProgress = false;
    this.connectionMonitor.stopMonitoring();
    this.eventManager.handleDisconnect();
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    this.remotePeerCode = '';
    this.retryHandler.resetAttempts();
  }

  pauseTransfer(filename: string): void {
    console.log('[WEBRTC] Pausing transfer for:', filename);
    this.dataChannelManager.pauseTransfer(filename);
  }

  resumeTransfer(filename: string): void {
    console.log('[WEBRTC] Resuming transfer for:', filename);
    this.dataChannelManager.resumeTransfer(filename);
  }

  private handleSignal = async (signal: SignalData) => {
    await this.signalingHandler.handleSignal(signal);
  };
}

export default WebRTCService;
