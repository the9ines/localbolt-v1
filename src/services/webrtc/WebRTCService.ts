
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
  private isConnecting: boolean = false;
  private isDisconnecting: boolean = false;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private readonly CONNECTION_TIMEOUT = 30000; // 30 seconds

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
      // Initialize core services
      this.encryptionService = new EncryptionService();
      this.onProgressCallback = onProgress;
      
      // Setup signaling
      this.signalingService = new SignalingService(
        this.localPeerCode,
        this.handleSignal.bind(this)
      );

      // Setup data channel manager with error recovery
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

      // Setup connection manager with enhanced error handling
      this.connectionManager = new ConnectionManager(
        (candidate) => {
          if (!this.remotePeerCode) {
            console.warn('[ICE] No remote peer code available');
            return;
          }
          this.signalingService.sendSignal('ice-candidate', candidate, this.remotePeerCode)
            .catch(error => {
              console.error('[ICE] Failed to send candidate:', error);
              this.handleError(error as WebRTCError);
            });
        },
        this.handleError.bind(this),
        (channel) => this.dataChannelManager.setupDataChannel(channel)
      );

      console.log('[INIT] WebRTC service initialized successfully');
    } catch (error) {
      const initError = new WebRTCError("Failed to initialize WebRTC service", error);
      console.error('[INIT] Initialization failed:', initError);
      throw initError;
    }
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    console.log('[WEBRTC] Setting new progress callback');
    this.onProgressCallback = callback;
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateHandler = handler;
    this.connectionManager.setConnectionStateChangeHandler(handler);
  }

  private handleError(error: WebRTCError) {
    console.error('[WEBRTC] Error:', error);
    
    // Clean up any ongoing connection attempt
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    // Reset connection state
    if (this.isConnecting) {
      this.isConnecting = false;
    }
    
    this.onError(error);
  }

  getRemotePeerCode(): string {
    return this.remotePeerCode;
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    if (this.isConnecting) {
      throw new ConnectionError("Connection already in progress");
    }

    if (this.isDisconnecting) {
      throw new ConnectionError("Cannot connect while disconnecting");
    }

    if (!remotePeerCode || remotePeerCode.length < 6) {
      throw new ConnectionError("Invalid remote peer code");
    }

    try {
      this.isConnecting = true;
      this.remotePeerCode = remotePeerCode;
      
      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        this.handleError(new ConnectionError("Connection timeout"));
        this.disconnect();
      }, this.CONNECTION_TIMEOUT);
      
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
    } finally {
      this.isConnecting = false;
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
    }
  }

  private async handleSignal(signal: SignalData) {
    try {
      if (!signal.type || !signal.from) {
        throw new WebRTCError("Invalid signal format");
      }

      const peerConnection = this.connectionManager.getPeerConnection() || 
                           await this.connectionManager.createPeerConnection();

      switch (signal.type) {
        case 'offer':
          if (!signal.data.offer || !signal.data.publicKey) {
            throw new WebRTCError("Invalid offer format");
          }
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
          if (!signal.data.answer || !signal.data.publicKey) {
            throw new WebRTCError("Invalid answer format");
          }
          this.encryptionService.setRemotePublicKey(signal.data.publicKey);
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
          break;

        case 'ice-candidate':
          if (peerConnection.remoteDescription) {
            await this.connectionManager.addIceCandidate(signal.data);
          } else {
            console.warn('[WEBRTC] Received ICE candidate before remote description');
          }
          break;

        default:
          console.warn('[WEBRTC] Unknown signal type:', signal.type);
      }
    } catch (error) {
      this.handleError(new WebRTCError("Signal handling failed", error));
    }
  }

  async sendFile(file: File) {
    if (!this.connectionManager.isConnected()) {
      throw new WebRTCError("Cannot send file - not connected");
    }

    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    await this.dataChannelManager.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    console.log('[WEBRTC] Cancelling transfer:', filename);
    this.dataChannelManager.cancelTransfer(filename, isReceiver);
  }

  disconnect() {
    if (this.isDisconnecting) {
      console.log('[WEBRTC] Already disconnecting');
      return;
    }

    console.log('[WEBRTC] Disconnecting');
    this.isDisconnecting = true;

    try {
      this.dataChannelManager.disconnect();
      this.connectionManager.disconnect();
      this.encryptionService.reset();
      this.remotePeerCode = '';
      
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
    } finally {
      this.isDisconnecting = false;
    }
  }

  pauseTransfer(filename: string): void {
    if (!this.connectionManager.isConnected()) {
      throw new WebRTCError("Cannot pause transfer - not connected");
    }
    console.log('[WEBRTC] Pausing transfer for:', filename);
    this.dataChannelManager.pauseTransfer(filename);
  }

  resumeTransfer(filename: string): void {
    if (!this.connectionManager.isConnected()) {
      throw new WebRTCError("Cannot resume transfer - not connected");
    }
    console.log('[WEBRTC] Resuming transfer for:', filename);
    this.dataChannelManager.resumeTransfer(filename);
  }
}

export default WebRTCService;
