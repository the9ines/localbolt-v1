
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { SignalingHandler } from './SignalingHandler';
import { DataChannelManager } from './DataChannelManager';
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCRetryHandler } from './WebRTCRetryHandler';
import { ConnectionQualityService } from './quality/ConnectionQualityService';
import { NetworkManager } from './network/NetworkManager';
import { ConnectionQualityMetrics } from './ConnectionQualityMonitor';
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
  private qualityService: ConnectionQualityService;
  private networkManager: NetworkManager;
  private onProgressCallback?: (progress: TransferProgress) => void;

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
  }

  private initializeServices() {
    this.connectionManager = new ConnectionManager(
      (candidate) => this.handleIceCandidate(candidate),
      this.handleError.bind(this),
      (channel) => this.dataChannelManager.setDataChannel(channel)
    );

    this.dataChannelManager = new DataChannelManager(
      this.encryptionService,
      this.onReceiveFile,
      this.handleProgress.bind(this),
      this.handleError.bind(this)
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
      (channel) => this.dataChannelManager.setDataChannel(channel)
    );

    this.eventManager = new WebRTCEventManager(
      this.connectionManager,
      this.dataChannelManager,
      this.handleError.bind(this)
    );

    this.qualityService = new ConnectionQualityService(
      this.connectionManager.getPeerConnection()
    );

    this.networkManager = new NetworkManager(
      this.onError,
      () => this.dataChannelManager.pauseAllTransfers(),
      () => this.dataChannelManager.resumeAllTransfers()
    );
  }

  async connect(remotePeerCode: string): Promise<void> {
    if (!this.networkManager.checkNetworkStatus()) {
      throw new ConnectionError(
        "Cannot establish new connections while offline",
        { detail: "Please check your network connection and try again" }
      );
    }

    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    this.remotePeerCode = remotePeerCode;
    
    try {
      const peerConnection = await this.connectionManager.createPeerConnection();
      await this.setupDataChannel(peerConnection);
      await this.initiateSignaling(peerConnection);
    } catch (error) {
      this.disconnect();
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    }
  }

  private async setupDataChannel(peerConnection: RTCPeerConnection) {
    const dataChannel = peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
      maxRetransmits: 3
    });
    this.dataChannelManager.setDataChannel(dataChannel);
  }

  private async initiateSignaling(peerConnection: RTCPeerConnection) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    await this.signalingService.sendSignal('offer', {
      offer,
      publicKey: this.encryptionService.getPublicKey(),
      peerCode: this.localPeerCode
    }, this.remotePeerCode);
  }

  private handleIceCandidate(candidate: RTCIceCandidate) {
    this.signalingService.sendSignal('ice-candidate', candidate, this.remotePeerCode)
      .catch(error => {
        console.error('[ICE] Failed to send candidate:', error);
        this.handleError(error as WebRTCError);
      });
  }

  private handleError(error: WebRTCError) {
    if (!this.networkManager.checkNetworkStatus()) {
      if (error instanceof ConnectionError) {
        error = new ConnectionError(
          "Cannot perform this action while offline",
          { detail: "Please wait for network connectivity to be restored" }
        );
      }
    }
    this.retryHandler.handleError(error, this.remotePeerCode);
  }

  private handleProgress(progress: TransferProgress) {
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }

  startQualityMonitoring(callback: (metrics: ConnectionQualityMetrics) => void) {
    this.qualityService.startMonitoring(callback);
  }

  stopQualityMonitoring() {
    this.qualityService.stopMonitoring();
  }

  // Public methods for file transfer
  async sendFile(file: File) {
    await this.dataChannelManager.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    this.dataChannelManager.cancelTransfer(filename, isReceiver);
  }

  pauseTransfer(filename: string) {
    this.dataChannelManager.pauseTransfer(filename);
  }

  resumeTransfer(filename: string) {
    this.dataChannelManager.resumeTransfer(filename);
  }

  disconnect() {
    this.eventManager.handleDisconnect();
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    this.remotePeerCode = '';
    this.retryHandler.resetAttempts();
    this.qualityService.stopMonitoring();
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.eventManager.setConnectionStateListener(handler);
  }

  setNetworkStateHandler(handler: (isOnline: boolean) => void) {
    this.networkManager.setNetworkStateHandler(handler);
  }

  getRemotePeerCode(): string {
    return this.signalingHandler.getRemotePeerCode();
  }

  getDiscoveryStatus() {
    return this.signalingService.getDiscoveryStatus();
  }

  private handleSignal = async (signal: SignalData) => {
    await this.signalingHandler.handleSignal(signal);
  };
}

export default WebRTCService;
