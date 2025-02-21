import { WebRTCError, ConnectionError, SignalingError, TransferError, EncryptionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { SignalingHandler } from './SignalingHandler';
import { DataChannelManager } from './DataChannelManager';
import type { TransferProgress } from './types/transfer';

class WebRTCService {
  private remotePeerCode: string = '';
  private connectionManager: ConnectionManager;
  private signalingHandler: SignalingHandler;
  private dataChannelManager: DataChannelManager;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private onProgressCallback?: (progress: TransferProgress) => void;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;
  private onDisconnectCallback?: () => void;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void,
    onDisconnect?: () => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    
    this.encryptionService = new EncryptionService();
    this.onProgressCallback = onProgress;
    this.onDisconnectCallback = onDisconnect;
    
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

    this.connectionManager.onConnectionStateChange = (state: RTCPeerConnectionState) => {
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        console.log('[WEBRTC] Connection state changed to:', state);
        if (this.onDisconnectCallback) {
          this.onDisconnectCallback();
        }
      }
    };
  }

  private handleError(error: WebRTCError) {
    console.error(`[${error.name}]`, error.message, error.details);
    
    if (error instanceof ConnectionError && this.connectionAttempts < this.maxConnectionAttempts) {
      console.log('[WEBRTC] Connection failed, attempting retry...');
      this.connectionAttempts++;
      this.retryConnection();
    } else {
      this.onError(error);
    }
  }

  private async retryConnection() {
    console.log('[WEBRTC] Retrying connection, attempt:', this.connectionAttempts);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      await this.connect(this.remotePeerCode);
    } catch (error) {
      this.handleError(error as WebRTCError);
    }
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    const connectionPromise = new Promise<void>(async (resolve, reject) => {
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
          publicKey: this.encryptionService.getPublicKey()
        }, remotePeerCode);

        const checkConnection = () => {
          const state = peerConnection.connectionState;
          if (state === 'connected') {
            console.log('[WEBRTC] Connection established successfully');
            this.connectionAttempts = 0;
            resolve();
          } else if (state === 'failed') {
            reject(new ConnectionError("Connection failed"));
          }
        };

        peerConnection.onconnectionstatechange = checkConnection;
        checkConnection();
      } catch (error) {
        reject(new ConnectionError("Failed to initiate connection", error));
      }
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new ConnectionError("Connection timeout"));
      }, this.connectionManager.getConnectionTimeout());
    });

    try {
      await Promise.race([connectionPromise, timeoutPromise]);
    } catch (error) {
      this.disconnect();
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    }
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.onProgressCallback = callback;
  }

  async sendFile(file: File) {
    console.log('[WEBRTC] Starting file transfer:', file.name);
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
    this.connectionAttempts = 0;
  }

  private handleSignal = async (signal: SignalData) => {
    await this.signalingHandler.handleSignal(signal);
  };

  setDisconnectCallback(callback: () => void) {
    this.onDisconnectCallback = callback;
  }
}

export default WebRTCService;
