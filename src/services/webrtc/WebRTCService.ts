
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { DataChannelManager } from './DataChannelManager';
import { SignalHandler } from './handlers/SignalHandler';
import type { TransferProgress } from './types/transfer';

class WebRTCService {
  private remotePeerCode: string = '';
  private connectionManager: ConnectionManager;
  private dataChannelManager: DataChannelManager;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private signalHandler: SignalHandler;
  private connectionStateHandler?: (state: RTCPeerConnectionState) => void;
  private onProgressCallback?: (progress: TransferProgress) => void;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    
    if (!localPeerCode || localPeerCode.length < 6) {
      throw new WebRTCError("Invalid peer code");
    }
    
    try {
      this.encryptionService = new EncryptionService();
      this.onProgressCallback = onProgress;
      
      this.connectionManager = new ConnectionManager(
        this.handleIceCandidate.bind(this),
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

      this.signalHandler = new SignalHandler(
        this.connectionManager,
        this.encryptionService,
        this.handleError.bind(this)
      );

      this.signalingService = new SignalingService(
        this.localPeerCode,
        this.handleSignal.bind(this)
      );

      console.log('[INIT] WebRTC service initialized successfully');
    } catch (error) {
      throw new WebRTCError("Failed to initialize WebRTC service", error);
    }
  }

  private handleError(error: WebRTCError) {
    console.error('[WEBRTC] Error:', error);
    this.onError(error);
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateHandler = handler;
    this.connectionManager.setConnectionStateChangeHandler(handler);
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.onProgressCallback = callback;
  }

  getRemotePeerCode(): string {
    return this.remotePeerCode;
  }

  private async handleIceCandidate(candidate: RTCIceCandidate) {
    if (!this.remotePeerCode) {
      console.warn('[ICE] No remote peer code available');
      return;
    }
    
    try {
      await this.signalingService.sendSignal('ice-candidate', candidate, this.remotePeerCode);
    } catch (error) {
      console.error('[ICE] Failed to send candidate:', error);
      this.handleError(error as WebRTCError);
    }
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    if (!remotePeerCode || remotePeerCode.length < 6) {
      throw new ConnectionError("Invalid remote peer code");
    }

    try {
      this.remotePeerCode = remotePeerCode;
      const peerConnection = await this.connectionManager.createPeerConnection();
      
      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true
      });
      
      this.dataChannelManager.setupDataChannel(dataChannel);

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      await this.signalingService.sendSignal('offer', {
        offer,
        publicKey: this.encryptionService.getPublicKey()
      }, remotePeerCode);

    } catch (error) {
      console.error('[WEBRTC] Connection failed:', error);
      this.disconnect();
      throw new ConnectionError("Connection failed", error);
    }
  }

  private async handleSignal(signal: SignalData) {
    await this.signalHandler.handleSignal(signal, (code) => this.remotePeerCode = code);
    
    if (signal.type === 'answer') {
      await this.signalingService.sendSignal('answer', {
        answer: signal.data.answer,
        publicKey: this.encryptionService.getPublicKey()
      }, signal.from);
    }
  }

  async sendFile(file: File) {
    if (!this.connectionManager.isConnected()) {
      throw new WebRTCError("Cannot send file - not connected");
    }
    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    await this.dataChannelManager.sendFile(file);
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting');
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    this.signalHandler.reset();
    this.remotePeerCode = '';
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    console.log('[WEBRTC] Cancelling transfer:', filename);
    this.dataChannelManager.cancelTransfer(filename, isReceiver);
  }

  pauseTransfer(filename: string): void {
    if (!this.connectionManager.isConnected()) {
      throw new WebRTCError("Cannot pause transfer - not connected");
    }
    this.dataChannelManager.pauseTransfer(filename);
  }

  resumeTransfer(filename: string): void {
    if (!this.connectionManager.isConnected()) {
      throw new WebRTCError("Cannot resume transfer - not connected");
    }
    this.dataChannelManager.resumeTransfer(filename);
  }
}

export default WebRTCService;
