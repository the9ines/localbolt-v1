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
  private networkStateHandler?: (isOnline: boolean) => void;
  private monitoringInterval?: NodeJS.Timeout;
  private qualityChangeCallback?: (metrics: ConnectionQualityMetrics) => void;

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
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    const handleNetworkChange = () => {
      const isOnline = navigator.onLine;
      console.log('[NETWORK] Connection status changed:', isOnline ? 'online' : 'offline');
      
      if (!isOnline) {
        this.handleOfflineMode();
      } else {
        this.handleOnlineMode();
      }
      
      if (this.networkStateHandler) {
        this.networkStateHandler(isOnline);
      }
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
  }

  private handleOfflineMode() {
    console.log('[NETWORK] Switching to offline mode');
    // If we're in the middle of a transfer, pause it
    if (this.dataChannelManager.hasActiveTransfers()) {
      this.dataChannelManager.pauseAllTransfers();
      this.onError(new ConnectionError(
        "Network connection lost",
        { detail: "Transfer paused due to network loss. Will resume when connection is restored." }
      ));
    }
  }

  private handleOnlineMode() {
    console.log('[NETWORK] Switching to online mode');
    // If we have paused transfers, attempt to resume them
    if (this.dataChannelManager.hasActiveTransfers()) {
      this.dataChannelManager.resumeAllTransfers();
    }
  }

  setNetworkStateHandler(handler: (isOnline: boolean) => void) {
    this.networkStateHandler = handler;
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
      (channel) => this.dataChannelManager.setDataChannel(channel)
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
  }

  private handleError(error: WebRTCError) {
    // Enhanced error handling with network state awareness
    if (!navigator.onLine) {
      // If we're offline, provide more specific error messages
      if (error instanceof ConnectionError) {
        error = new ConnectionError(
          "Cannot perform this action while offline",
          { detail: "Please wait for network connectivity to be restored" }
        );
      }
    }
    this.retryHandler.handleError(error, this.remotePeerCode);
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.eventManager.setConnectionStateListener(handler);
  }

  getRemotePeerCode(): string {
    return this.signalingHandler.getRemotePeerCode();
  }

  getDiscoveryStatus() {
    return this.signalingService.getDiscoveryStatus();
  }

  async connect(remotePeerCode: string): Promise<void> {
    if (!navigator.onLine) {
      throw new ConnectionError(
        "Cannot establish new connections while offline",
        { detail: "Please check your network connection and try again" }
      );
    }

    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    const connectionPromise = new Promise<void>(async (resolve, reject) => {
      try {
        this.remotePeerCode = remotePeerCode;
        const peerConnection = await this.connectionManager.createPeerConnection();
        
        const dataChannel = peerConnection.createDataChannel('fileTransfer', {
          ordered: true,
          maxRetransmits: 3
        });
        
        this.dataChannelManager.setDataChannel(dataChannel);
        
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
          if (state === 'connected') {
            console.log('[WEBRTC] Connection established successfully');
            this.retryHandler.resetAttempts();
            resolve();
          } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
            console.log('[WEBRTC] Connection state changed to:', state);
            reject(new ConnectionError("Connection failed or closed"));
          }
        };
      } catch (error) {
        reject(new ConnectionError("Failed to initiate connection", error));
      }
    });

    try {
      await Promise.race([
        connectionPromise,
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new ConnectionError("Connection timeout"));
          }, 30000);
        })
      ]);
    } catch (error) {
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

  startQualityMonitoring(callback: (metrics: ConnectionQualityMetrics) => void) {
    this.qualityChangeCallback = callback;
    const connection = this.connectionManager.getPeerConnection();
    
    if (!connection) {
      console.warn('[QUALITY] No peer connection available for monitoring');
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const stats = await connection.getStats();
        const metrics = this.processConnectionStats(stats);
        if (this.qualityChangeCallback) {
          this.qualityChangeCallback(metrics);
        }
      } catch (error) {
        console.error('[QUALITY] Failed to get connection stats:', error);
      }
    }, 2000);
  }

  stopQualityMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.qualityChangeCallback = undefined;
  }

  private processConnectionStats(stats: RTCStatsReport): ConnectionQualityMetrics {
    let rtt = 0;
    let packetLoss = 0;
    let bandwidth = 0;

    stats.forEach(stat => {
      if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        rtt = stat.currentRoundTripTime ? stat.currentRoundTripTime * 1000 : 0;
      }
      if (stat.type === 'inbound-rtp') {
        packetLoss = stat.packetsLost ? (stat.packetsLost / stat.packetsReceived) * 100 : 0;
      }
      if (stat.type === 'media-source') {
        bandwidth = stat.bitrate || 0;
      }
    });

    let quality: ConnectionQualityMetrics['currentQuality'] = 'good';
    
    if (rtt < 50 && packetLoss < 0.5) {
      quality = 'excellent';
    } else if (rtt < 150 && packetLoss < 2) {
      quality = 'good';
    } else if (rtt < 300 && packetLoss < 5) {
      quality = 'fair';
    } else if (rtt < 500 && packetLoss < 10) {
      quality = 'poor';
    } else {
      quality = 'critical';
    }

    return {
      rtt,
      packetLoss,
      bandwidth,
      currentQuality: quality,
      timestamp: Date.now()
    };
  }
}

export default WebRTCService;
