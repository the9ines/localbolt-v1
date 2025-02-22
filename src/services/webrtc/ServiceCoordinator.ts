import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './types/transfer';
import { ConnectionManager } from './ConnectionManager';
import { SignalingHandler } from './SignalingHandler';
import { DataChannelManager } from './DataChannelManager';
import { EncryptionService } from './EncryptionService';
import { SignalingService } from './SignalingService';
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCRetryHandler } from './WebRTCRetryHandler';
import { ConnectionStateManager } from './connection/ConnectionStateManager';
import { ConnectionInitializer } from './connection/ConnectionInitializer';
import { SessionManager } from './session/SessionManager';

export class ServiceCoordinator {
  private connectionManager: ConnectionManager;
  private signalingHandler: SignalingHandler;
  private dataChannelManager: DataChannelManager;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private eventManager: WebRTCEventManager;
  private retryHandler: WebRTCRetryHandler;
  private connectionStateManager: ConnectionStateManager;
  private connectionInitializer: ConnectionInitializer;
  private sessionManager: SessionManager;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    this.sessionManager = new SessionManager(onError);
    this.initializeServices();
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.onProgress = callback;
    if (this.dataChannelManager) {
      this.dataChannelManager.setProgressCallback(callback);
    }
  }

  private initializeServices() {
    this.encryptionService = new EncryptionService();
    
    this.dataChannelManager = new DataChannelManager(
      this.encryptionService,
      this.onReceiveFile,
      this.onProgress || (() => {}),
      this.onError
    );

    this.connectionManager = new ConnectionManager(
      (candidate) => {
        this.signalingService.sendSignal('ice-candidate', candidate, this.sessionManager.getRemotePeerCode())
          .catch(error => this.onError(error as WebRTCError));
      },
      this.onError,
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
      this.onError
    );

    this.connectionStateManager = new ConnectionStateManager(
      this.onError,
      this.connect.bind(this)
    );

    this.connectionInitializer = new ConnectionInitializer(
      this.connectionManager,
      this.signalingService,
      this.encryptionService,
      this.dataChannelManager,
      (state) => this.connectionStateManager.handleConnectionStateChange(state, this.sessionManager.getRemotePeerCode())
    );

    this.retryHandler = new WebRTCRetryHandler(
      this.onError,
      this.connect.bind(this)
    );
  }

  private handleSignal = async (signal: any) => {
    try {
      await this.signalingHandler.handleSignal(signal);
    } catch (error) {
      console.error('[SIGNALING] Error handling signal:', error);
      this.onError(error as WebRTCError);
    }
  };

  async connect(remotePeerCode: string): Promise<void> {
    if (this.sessionManager.isConnecting()) {
      console.log('[WEBRTC] Connection already in progress, waiting...');
      return this.sessionManager.getCurrentPromise();
    }

    this.sessionManager.startConnection();
    this.sessionManager.setRemotePeerCode(remotePeerCode);
    this.sessionManager.setInitiator(this.localPeerCode > remotePeerCode);

    const connectionPromise = this.connectionInitializer.initializeConnection(
      remotePeerCode,
      this.localPeerCode,
      this.sessionManager.isInitiatorPeer()
    ).finally(() => {
      this.sessionManager.endConnection();
    });

    this.sessionManager.setConnectionPromise(connectionPromise);
    
    return connectionPromise;
  }

  disconnect() {
    this.connectionManager.disconnect();
    this.dataChannelManager.disconnect();
    this.eventManager.handleDisconnect();
    this.connectionStateManager.cleanup();
    this.encryptionService.reset();
    this.signalingHandler.reset();
    this.retryHandler.resetAttempts();
    this.sessionManager.reset();
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.eventManager.setConnectionStateListener((state) => {
      handler(state);
      this.connectionStateManager.handleConnectionStateChange(
        state,
        this.sessionManager.getRemotePeerCode()
      );
    });
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    await this.dataChannelManager.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    console.log('[WEBRTC] Cancelling transfer:', filename);
    this.dataChannelManager.cancelTransfer(filename, isReceiver);
  }

  pauseTransfer(filename: string): void {
    console.log('[WEBRTC] Pausing transfer for:', filename);
    this.dataChannelManager.pauseTransfer(filename);
  }

  resumeTransfer(filename: string): void {
    console.log('[WEBRTC] Resuming transfer for:', filename);
    this.dataChannelManager.resumeTransfer(filename);
  }
}
