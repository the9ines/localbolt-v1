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
  private connectionStateListener?: (state: RTCPeerConnectionState) => void;
  private onRemotePeerCodeUpdate?: (code: string) => void;

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
    this.onRemotePeerCodeUpdate = onRemotePeerCode;
    
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

    this.connectionManager.setConnectionStateChangeHandler((state: RTCPeerConnectionState) => {
      console.log('[CONNECTION] State changed:', state);
      if (state === 'connected') {
        console.log('[CONNECTION] Connected, updating remote peer code:', this.remotePeerCode);
        if (this.onRemotePeerCodeUpdate) {
          this.onRemotePeerCodeUpdate(this.remotePeerCode);
        }
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        console.log('[CONNECTION] Connection lost or closed');
        this.handleDisconnection();
      }
      if (this.connectionStateListener) {
        this.connectionStateListener(state);
      }
    });
  }

  private handleDisconnection() {
    console.log('[CONNECTION] Handling disconnection');
    if (this.onRemotePeerCodeUpdate) {
      this.onRemotePeerCodeUpdate('');
    }
    this.remotePeerCode = '';
    this.connectionAttempts = 0;
    if (this.connectionStateListener) {
      this.connectionStateListener('disconnected');
    }
  }

  private async handleSignal(signal: SignalData) {
    if (signal.to !== this.localPeerCode) return;
    console.log('[SIGNALING] Processing signal:', signal.type, 'from:', signal.from);

    try {
      if (signal.from && !this.remotePeerCode) {
        console.log('[SIGNALING] Setting remote peer code from signal:', signal.from);
        this.remotePeerCode = signal.from;
        if (this.onRemotePeerCodeUpdate) {
          this.onRemotePeerCodeUpdate(signal.from);
        }
      }

      switch (signal.type) {
        case 'offer':
          await this.signalingHandler.handleSignal(signal);
          break;
        case 'answer':
          await this.signalingHandler.handleSignal(signal);
          console.log('[SIGNALING] Answer processed, connection established');
          if (this.connectionStateListener) {
            this.connectionStateListener('connected');
          }
          break;
        case 'ice-candidate':
          await this.signalingHandler.handleSignal(signal);
          break;
        case 'disconnect':
          console.log('[SIGNALING] Received disconnect signal from peer');
          this.handleDisconnection();
          break;
      }
    } catch (error) {
      console.error('[SIGNALING] Handler error:', error);
      throw error;
    }
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

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    console.log('[WEBRTC] Setting connection state handler');
    this.connectionStateListener = handler;
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
          
          if (state === 'connected') {
            console.log('[WEBRTC] Connection established successfully');
            this.connectionAttempts = 0;
            if (this.connectionStateListener) {
              this.connectionStateListener('connected');
            }
            resolve();
          } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
            reject(new ConnectionError("Connection failed"));
          }
        };

        // Set up beforeunload event listener
        window.addEventListener('beforeunload', () => {
          console.log('[WEBRTC] Page unloading, disconnecting...');
          this.disconnect();
        });

      } catch (error) {
        reject(new ConnectionError("Failed to initiate connection", error));
      }
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new ConnectionError("Connection timeout"));
      }, 30000); // 30 seconds timeout
    });

    try {
      await Promise.race([connectionPromise, timeoutPromise]);
    } catch (error) {
      this.handleDisconnection();
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    }
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

  disconnect() {
    console.log('[WEBRTC] Disconnecting');
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    
    // Notify the other peer about disconnection
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
