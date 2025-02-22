import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { SignalingHandler } from './SignalingHandler';
import { DataChannelManager } from './DataChannelManager';
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCRetryHandler } from './WebRTCRetryHandler';
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
  private onProgressCallback?: (progress: TransferProgress) => void;
  private isConnectionInProgress: boolean = false;
  private connectionPromise?: Promise<void>;
  private isInitiator: boolean = false;
  private connectionAttemptTimestamp: number = 0;
  private autoReconnectEnabled: boolean = true;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectTimeout?: NodeJS.Timeout;

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
    this.retryHandler = new WebRTCRetryHandler(this.onError, this.handleReconnect.bind(this));
  }

  private initializeServices() {
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

  private async handleReconnect() {
    if (!this.autoReconnectEnabled || !this.remotePeerCode || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WEBRTC] Not attempting reconnection:', {
        autoReconnectEnabled: this.autoReconnectEnabled,
        remotePeerCode: this.remotePeerCode,
        attempts: this.reconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    console.log(`[WEBRTC] Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    try {
      await this.connect(this.remotePeerCode);
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('[WEBRTC] Reconnection attempt failed:', error);
      
      const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      this.reconnectTimeout = setTimeout(() => this.handleReconnect(), backoffTime);
    }
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.eventManager.setConnectionStateListener((state) => {
      handler(state);
      
      if (state === 'disconnected' || state === 'failed') {
        console.log('[WEBRTC] Connection lost, initiating recovery...');
        this.handleReconnect();
      }
    });
  }

  private handleError(error: WebRTCError) {
    console.error('[WEBRTC] Error occurred:', error);
    if (error.name === 'ConnectionError') {
      this.handleReconnect();
    }
    this.retryHandler.handleError(error, this.remotePeerCode);
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
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = undefined;
        }

        this.remotePeerCode = remotePeerCode;
        this.isInitiator = this.shouldInitiateConnection(remotePeerCode);
        
        if (!this.isInitiator) {
          console.log('[WEBRTC] Not initiator, waiting for offer from peer');
          setTimeout(() => {
            if (!this.connectionManager.getPeerConnection()?.remoteDescription) {
              reject(new ConnectionError("No offer received"));
            }
          }, 10000);
          return;
        }

        const peerConnection = await this.connectionManager.createPeerConnection();
        
        peerConnection.oniceconnectionstatechange = () => {
          console.log('[ICE] Connection state changed:', peerConnection.iceConnectionState);
          if (peerConnection.iceConnectionState === 'disconnected') {
            this.handleReconnect();
          }
        };

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
          console.log('[WEBRTC] Connection state changed to:', state);
          
          if (state === 'connected') {
            console.log('[WEBRTC] Connection established successfully');
            this.retryHandler.resetAttempts();
            this.reconnectAttempts = 0;
            resolve();
          } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
            console.log('[WEBRTC] Connection state changed to:', state);
            reject(new ConnectionError("Connection failed or closed"));
          }
        };
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
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    
    this.autoReconnectEnabled = false;
    this.reconnectAttempts = 0;
    
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

  public pauseTransfer(filename: string): void {
    console.log('[WEBRTC] Pausing transfer for:', filename);
    if (this.dataChannelManager) {
      this.dataChannelManager.pauseTransfer(filename);
    }
  }

  public resumeTransfer(filename: string): void {
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
