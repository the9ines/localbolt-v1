
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { SignalingHandler } from './SignalingHandler';
import { DataChannelManager } from './DataChannelManager';
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCRetryHandler } from './WebRTCRetryHandler';
import { ConnectionStateManager } from './connection/ConnectionStateManager';
import { ConnectionInitializer } from './connection/ConnectionInitializer';
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
  private connectionStateManager: ConnectionStateManager;
  private connectionInitializer: ConnectionInitializer;
  private onProgressCallback?: (progress: TransferProgress) => void;
  private isConnectionInProgress: boolean = false;
  private connectionPromise?: Promise<void>;
  private isInitiator: boolean = false;

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
    this.connectionStateManager = new ConnectionStateManager(this.onError, this.connect.bind(this));
    this.retryHandler = new WebRTCRetryHandler(this.onError, this.handleReconnect.bind(this));
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
        this.signalingService.sendSignal('ice-candidate', candidate, this.remotePeerCode)
          .catch(error => this.handleError(error as WebRTCError));
      },
      this.handleError.bind(this),
      (channel) => this.dataChannelManager.setupDataChannel(channel)
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
      this.signalingService,
      this.encryptionService,
      this.dataChannelManager,
      (state) => this.connectionStateManager.handleConnectionStateChange(state, this.remotePeerCode)
    );
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.eventManager.setConnectionStateListener((state) => {
      handler(state);
      this.connectionStateManager.handleConnectionStateChange(state, this.remotePeerCode);
    });
  }

  private handleError(error: WebRTCError) {
    console.error('[WEBRTC] Error occurred:', error);
    if (error.name === 'ConnectionError') {
      this.handleReconnect();
    }
    this.retryHandler.handleError(error, this.remotePeerCode);
  }

  private handleReconnect() {
    this.connectionStateManager.handleReconnect(this.remotePeerCode);
  }

  getRemotePeerCode(): string {
    return this.signalingHandler.getRemotePeerCode();
  }

  private shouldInitiateConnection(remotePeerCode: string): boolean {
    return this.localPeerCode > remotePeerCode;
  }

  async connect(remotePeerCode: string): Promise<void> {
    if (this.isConnectionInProgress) {
      console.log('[WEBRTC] Connection already in progress, waiting...');
      return this.connectionPromise;
    }

    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    this.isConnectionInProgress = true;
    this.connectionPromise = new Promise<void>(async (resolve, reject) => {
      try {
        this.remotePeerCode = remotePeerCode;
        this.isInitiator = this.shouldInitiateConnection(remotePeerCode);
        
        await this.connectionInitializer.initializeConnection(
          remotePeerCode,
          this.localPeerCode,
          this.isInitiator
        );
        
        this.retryHandler.resetAttempts();
        this.connectionStateManager.reset();
        resolve();
      } catch (error) {
        reject(new ConnectionError("Failed to initiate connection", error));
      } finally {
        this.isConnectionInProgress = false;
      }
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new ConnectionError("Connection timeout"));
      }, 30000);
    });

    try {
      await Promise.race([this.connectionPromise, timeoutPromise]);
    } catch (error) {
      this.disconnect();
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    } finally {
      this.isConnectionInProgress = false;
      this.connectionPromise = undefined;
    }
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting');
    this.connectionStateManager.cleanup();
    this.eventManager.handleDisconnect();
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    this.signalingHandler.reset();
    this.remotePeerCode = '';
    this.retryHandler.resetAttempts();
    this.isInitiator = false;
    this.isConnectionInProgress = false;
    this.connectionPromise = undefined;
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.onProgressCallback = callback;
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
    if (this.dataChannelManager) {
      this.dataChannelManager.pauseTransfer(filename);
    }
  }

  resumeTransfer(filename: string): void {
    console.log('[WEBRTC] Resuming transfer for:', filename);
    if (this.dataChannelManager) {
      this.dataChannelManager.resumeTransfer(filename);
    }
  }

  private handleSignal = async (signal: SignalData) => {
    try {
      await this.signalingHandler.handleSignal(signal);
    } catch (error) {
      console.error('[SIGNALING] Error handling signal:', error);
      this.handleError(error as WebRTCError);
    }
  };
}

export default WebRTCService;
