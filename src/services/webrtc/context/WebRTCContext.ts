
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService } from '../SignalingService';
import { EncryptionService } from '../EncryptionService';
import { ConnectionManager } from '../ConnectionManager';
import { SignalingHandler } from '../SignalingHandler';
import { DataChannelManager } from '../DataChannelManager';
import { WebRTCEventManager } from '../WebRTCEventManager';
import { WebRTCRetryHandler } from '../WebRTCRetryHandler';
import type { TransferProgress } from '../types/transfer';

/**
 * Core WebRTC context class that manages all services and connections.
 * This class orchestrates the interactions between various service components.
 */
export class WebRTCContext {
  private remotePeerCode: string = '';
  private connectionManager: ConnectionManager;
  private signalingHandler: SignalingHandler;
  private dataChannelManager: DataChannelManager;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private eventManager: WebRTCEventManager;
  private retryHandler: WebRTCRetryHandler;
  private onProgressCallback?: (progress: TransferProgress) => void;
  private isInitialized: boolean = false;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    console.log('[INIT] Creating WebRTC context with peer code:', localPeerCode);
    
    this.encryptionService = new EncryptionService();
    this.onProgressCallback = onProgress;
    
    this.createServices();
    this.retryHandler = new WebRTCRetryHandler(this.onError, this.connect.bind(this));
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[INIT] Context already initialized');
      return;
    }
    
    console.log('[INIT] Initializing WebRTC context');
    await this.signalingService.initialize();
    this.isInitialized = true;
  }

  private createServices() {
    this.dataChannelManager = new DataChannelManager(
      this.encryptionService,
      this.onReceiveFile,
      (progress) => {
        console.log('[TRANSFER] Progress update:', progress);
        if (this.onProgressCallback) {
          this.onProgressCallback(progress);
        }
      },
      this.handleError.bind(this)
    );

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
  }

  private handleError(error: WebRTCError) {
    this.retryHandler.handleError(error, this.remotePeerCode);
  }

  getRemotePeerCode(): string {
    return this.signalingHandler.getRemotePeerCode();
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.eventManager.setConnectionStateListener(handler);
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.onProgressCallback = callback;
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting');
    this.eventManager.handleDisconnect();
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    this.remotePeerCode = '';
    this.retryHandler.resetAttempts();
  }

  private handleSignal = async (signal: any) => {
    await this.signalingHandler.handleSignal(signal);
  };

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const connectionPromise = new Promise<void>((resolve, reject) => {
      this.initiateConnection(remotePeerCode, resolve, reject);
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new ConnectionError("Connection timeout"));
      }, 30000);
    });

    try {
      await Promise.race([connectionPromise, timeoutPromise]);
    } catch (error) {
      this.disconnect();
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    }
  }

  private async initiateConnection(
    remotePeerCode: string,
    resolve: (value: void | PromiseLike<void>) => void,
    reject: (reason?: any) => void
  ): Promise<void> {
    try {
      this.remotePeerCode = remotePeerCode;
      const peerConnection = await this.connectionManager.createPeerConnection();
      
      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true,
        maxRetransmits: 3
      });
      
      this.dataChannelManager.setupDataChannel(dataChannel);
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log('[SIGNALING] Created and set local description (offer)');
      
      await this.signalingService.sendSignal('offer', {
        offer,
        publicKey: this.encryptionService.getPublicKey(),
        peerCode: this.localPeerCode
      }, remotePeerCode);

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === 'connected') {
          console.log('[WEBRTC] Connection established successfully');
          this.retryHandler.resetAttempts();
          resolve();
        } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          console.log('[WEBRTC] Connection state changed to:', state);
          reject(new ConnectionError("Connection failed or closed"));
        }
      };
    } catch (error) {
      reject(new ConnectionError("Failed to initiate connection", error));
    }
  }
}
