
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { SignalingHandler } from './SignalingHandler';
import { DataChannelManager } from './DataChannelManager';
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCRetryHandler } from './WebRTCRetryHandler';
import { ConnectionNegotiator } from './protocol/ConnectionNegotiator';
import { NetworkDiscovery } from './discovery/NetworkDiscovery';
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
  private networkDiscovery: NetworkDiscovery;
  private connectionNegotiator: ConnectionNegotiator;
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
    this.signalingService = new SignalingService(this.localPeerCode, this.handleSignal.bind(this));
    
    this.networkDiscovery = new NetworkDiscovery(
      this.signalingService,
      {
        deviceId: this.localPeerCode,
        capabilities: {
          mdns: true,
          webrtc: true,
          encryption: ['aes-gcm']
        },
        networkType: 'local'
      }
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

    this.connectionNegotiator = new ConnectionNegotiator(
      this.networkDiscovery,
      this.connectionManager,
      this.signalingService,
      (state) => {
        if (this.eventManager) {
          this.eventManager.setConnectionStateListener((newState) => {
            this.eventManager.connectionStateListener?.(newState);
          });
        }
      }
    );
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.eventManager.setConnectionStateListener(handler);
  }

  private handleError(error: WebRTCError) {
    this.retryHandler.handleError(error, this.remotePeerCode);
  }

  getRemotePeerCode(): string {
    return this.signalingHandler.getRemotePeerCode();
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    try {
      this.remotePeerCode = remotePeerCode;
      await this.connectionNegotiator.negotiateConnection(remotePeerCode);
    } catch (error) {
      console.error('[WEBRTC] Connection failed:', error);
      this.disconnect();
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
    this.eventManager.handleDisconnect();
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    this.connectionNegotiator.reset();
    this.remotePeerCode = '';
    this.retryHandler.resetAttempts();
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
    await this.signalingHandler.handleSignal(signal);
  };
}

export default WebRTCService;
