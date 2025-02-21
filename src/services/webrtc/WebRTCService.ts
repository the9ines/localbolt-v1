
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { DataChannelManager } from './DataChannelManager';
import { ConnectionStateManager } from './managers/ConnectionStateManager';
import { SignalingManager } from './managers/SignalingManager';
import type { TransferProgress } from './types/transfer';

class WebRTCService {
  private remotePeerCode: string = '';
  private connectionManager: ConnectionManager;
  private dataChannelManager: DataChannelManager;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private connectionStateManager: ConnectionStateManager;
  private signalingManager: SignalingManager;
  private onProgressCallback?: (progress: TransferProgress) => void;
  private stateChangeCallback?: (state: RTCPeerConnectionState) => void;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void,
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    
    this.encryptionService = new EncryptionService();
    this.onProgressCallback = onProgress;
    this.stateChangeCallback = onConnectionStateChange;
    
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
        console.log('[TRANSFER] Progress update:', progress);
        if (this.onProgressCallback) {
          this.onProgressCallback(progress);
        }
      },
      this.handleError.bind(this)
    );

    this.signalingService = new SignalingService(localPeerCode, this.handleSignal.bind(this));

    this.connectionStateManager = new ConnectionStateManager(
      this.connectionManager,
      this.onError,
      (state) => {
        if (this.stateChangeCallback) {
          this.stateChangeCallback(state);
        }
      }
    );

    this.signalingManager = new SignalingManager(
      this.signalingService,
      this.connectionManager,
      this.encryptionService,
      localPeerCode,
      (channel) => this.dataChannelManager.setupDataChannel(channel)
    );
  }

  private handleError(error: WebRTCError) {
    this.connectionStateManager.handleError(error);
  }

  private async handleSignal(signal: SignalData) {
    const shouldDisconnect = await this.signalingManager.handleSignal(
      signal,
      this.remotePeerCode,
      (state) => {
        if (this.stateChangeCallback) {
          this.stateChangeCallback(state);
        }
      }
    );

    if (shouldDisconnect) {
      this.disconnect();
    }

    if (signal.from) {
      this.remotePeerCode = signal.from;
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

        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection.connectionState;
          console.log('[WEBRTC] Connection state changed:', state);
          if (state === 'connected') {
            this.connectionStateManager.resetConnectionAttempts();
            resolve();
          } else if (state === 'failed') {
            reject(new ConnectionError("Connection failed"));
          }
        };
      } catch (error) {
        reject(new ConnectionError("Failed to initiate connection", error));
      }
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
    this.connectionStateManager.resetConnectionAttempts();
  }

  public getRemotePeerCode(): string {
    return this.remotePeerCode;
  }
}

export default WebRTCService;
