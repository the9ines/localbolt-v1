import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { SignalingHandler } from './SignalingHandler';
import { DataChannelManager } from './DataChannelManager';
import { ConnectionStateHandler } from './handlers/ConnectionStateHandler';
import { ConnectionInitializer } from './handlers/ConnectionInitializer';
import type { TransferProgress } from './types/transfer';

class WebRTCService {
  private remotePeerCode: string = '';
  private connectionManager: ConnectionManager;
  private signalingHandler: SignalingHandler;
  private dataChannelManager: DataChannelManager;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private connectionStateHandler: ConnectionStateHandler;
  private connectionInitializer: ConnectionInitializer;
  private onProgressCallback?: (progress: TransferProgress) => void;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void,
    onRemotePeerCode?: (code: string) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    
    this.encryptionService = new EncryptionService();
    this.onProgressCallback = onProgress;
    
    this.connectionStateHandler = new ConnectionStateHandler(
      onRemotePeerCode,
      (state) => this.handleConnectionStateChange(state)
    );
    
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

    this.signalingService = new SignalingService(localPeerCode, this.handleSignal.bind(this));
    
    this.signalingHandler = new SignalingHandler(
      this.connectionManager,
      this.encryptionService,
      this.signalingService,
      localPeerCode,
      (channel) => this.dataChannelManager.setupDataChannel(channel)
    );

    this.connectionInitializer = new ConnectionInitializer(
      this.connectionManager,
      this.dataChannelManager,
      this.signalingService,
      this.encryptionService,
      (state) => this.handleConnectionStateChange(state)
    );
  }

  private handleConnectionStateChange(state: RTCPeerConnectionState) {
    this.connectionStateHandler.handleConnectionStateChange(state, this.remotePeerCode);
  }

  async connect(remotePeerCode: string): Promise<void> {
    try {
      this.remotePeerCode = remotePeerCode;
      const peerConnection = await this.connectionManager.createPeerConnection();
      
      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true,
        maxRetransmits: 3
      });
      
      this.dataChannelManager.setupDataChannel(dataChannel);
      
      peerConnection.ondatachannel = (event) => {
        console.log('[WEBRTC] Received data channel');
        this.dataChannelManager.setupDataChannel(event.channel);
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log('[SIGNALING] Created and set local description (offer)');
      
      await this.signalingService.sendSignal('offer', {
        offer,
        publicKey: this.encryptionService.getPublicKey()
      }, remotePeerCode);

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('[WEBRTC] Connection state changed:', state);
        this.handleConnectionStateChange(state);
      };

    } catch (error) {
      this.handleDisconnection();
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    }
  }

  private handleError(error: WebRTCError) {
    console.error(`[${error.name}]`, error.message, error.details);
    
    if (error instanceof ConnectionError && this.connectionStateHandler.shouldRetryConnection()) {
      console.log('[WEBRTC] Connection failed, attempting retry...');
      this.connectionStateHandler.incrementConnectionAttempts();
      this.retryConnection();
    } else {
      this.onError(error);
    }
  }

  private async retryConnection() {
    console.log('[WEBRTC] Retrying connection');
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      await this.connect(this.remotePeerCode);
    } catch (error) {
      this.handleError(error as WebRTCError);
    }
  }

  private handleDisconnection() {
    console.log('[WEBRTC] Disconnecting due to peer disconnect signal');
    this.connectionStateHandler.handleDisconnection();
    this.remotePeerCode = '';
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateHandler.setConnectionStateHandler(handler);
  }

  async sendFile(file: File) {
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    await this.dataChannelManager.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    console.log('[WEBRTC] Cancelling transfer:', filename);
    this.dataChannelManager.cancelTransfer(filename, isReceiver);
  }

  disconnect() {
    console.log('[WEBRTC] Manual disconnect initiated');
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    
    if (this.remotePeerCode) {
      this.signalingService.sendSignal('disconnect', {}, this.remotePeerCode)
        .catch(console.error);
    }
    
    this.handleDisconnection();
  }

  getRemotePeerCode(): string {
    return this.remotePeerCode;
  }
}

export default WebRTCService;
