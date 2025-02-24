
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { DataChannelManager } from './DataChannelManager';
import type { TransferProgress } from './types/transfer';

class WebRTCService {
  private remotePeerCode: string = '';
  private connectionManager: ConnectionManager;
  private dataChannelManager: DataChannelManager;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private connectionStateHandler?: (state: RTCPeerConnectionState) => void;
  private onProgressCallback?: (progress: TransferProgress) => void;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    
    // Initialize core services
    this.encryptionService = new EncryptionService();
    this.onProgressCallback = onProgress;
    
    // Setup signaling
    this.signalingService = new SignalingService(
      this.localPeerCode,
      this.handleSignal.bind(this)
    );

    // Setup data channel manager
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

    // Setup connection manager
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
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateHandler = handler;
    this.connectionManager.setConnectionStateChangeHandler(handler);
  }

  private handleError(error: WebRTCError) {
    console.error('[WEBRTC] Error:', error);
    this.onError(error);
  }

  getRemotePeerCode(): string {
    return this.remotePeerCode;
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    try {
      this.remotePeerCode = remotePeerCode;
      
      // Create and setup peer connection
      const peerConnection = await this.connectionManager.createPeerConnection();
      
      // Create data channel
      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true
      });
      
      this.dataChannelManager.setupDataChannel(dataChannel);

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      // Send offer with encryption key
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
    try {
      const peerConnection = this.connectionManager.getPeerConnection() || 
                           await this.connectionManager.createPeerConnection();

      switch (signal.type) {
        case 'offer':
          this.encryptionService.setRemotePublicKey(signal.data.publicKey);
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.offer));
          
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          await this.signalingService.sendSignal('answer', {
            answer,
            publicKey: this.encryptionService.getPublicKey()
          }, signal.from);
          break;

        case 'answer':
          this.encryptionService.setRemotePublicKey(signal.data.publicKey);
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
          break;

        case 'ice-candidate':
          if (peerConnection.remoteDescription) {
            await this.connectionManager.addIceCandidate(signal.data);
          }
          break;
      }
    } catch (error) {
      this.handleError(new WebRTCError("Signal handling failed", error));
    }
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
    console.log('[WEBRTC] Disconnecting');
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    this.remotePeerCode = '';
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

export default WebRTCService;
