
import { SignalingService, SignalData } from './SignalingService';
import { DataChannelManager } from './DataChannelManager';
import { EncryptionService } from './EncryptionService';
import { EventManager } from './EventManager';
import { ConnectionError, SignalingError, WebRTCError } from '@/types/webrtc-errors';
import { TransferProgress } from './types/transfer';
import { IWebRTCService, WebRTCCallbacks, WebRTCConfig } from './interfaces/WebRTCInterfaces';

const DEFAULT_CONFIG: WebRTCConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export default class WebRTCService extends EventManager implements IWebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannelManager: DataChannelManager | null = null;
  private peerId: string | null = null;
  private progressCallback: ((progress: TransferProgress) => void) | null = null;
  private connectionStateHandler: ((state: RTCPeerConnectionState) => void) | null = null;

  constructor(
    private localPeerCode: string,
    private callbacks: WebRTCCallbacks,
    private config: WebRTCConfig = DEFAULT_CONFIG
  ) {
    super();
    this.initializeServices();
    this.setupSignalingHandlers();
  }

  private initializeServices(): void {
    const encryptionService = new EncryptionService();
    const signalingService = new SignalingService(this.localPeerCode, this.handleSignal.bind(this));
    this.dataChannelManager = new DataChannelManager(
      encryptionService,
      this.callbacks.onReceiveFile,
      this.handleProgress.bind(this),
      this.callbacks.onError
    );
  }

  private handleSignal(signal: SignalData): void {
    if (signal.to !== this.localPeerCode) return;
    
    console.log('[WEBRTC] Received signal:', signal.type, 'from:', signal.from);
    this.emit(signal.type, signal.data, signal.from);
  }

  private setupSignalingHandlers(): void {
    this.on('offer', this.handleOffer.bind(this));
    this.on('answer', this.handleAnswer.bind(this));
    this.on('ice-candidate', this.handleICECandidate.bind(this));
  }

  private async createPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(this.config);
    this.setupPeerConnectionHandlers();
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = this.handleICECandidateEvent.bind(this);
    this.peerConnection.oniceconnectionstatechange = this.handleICEConnectionStateChangeEvent.bind(this);
    this.peerConnection.onconnectionstatechange = this.handleConnectionStateChangeEvent.bind(this);
    this.peerConnection.ondatachannel = this.handleDataChannel.bind(this);
  }

  public async connectToPeer(peerId: string): Promise<void> {
    this.peerId = peerId;
    try {
      await this.createPeerConnection();
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      this.emit('send-offer', offer, peerId);
    } catch (error) {
      this.callbacks.onError(new ConnectionError('Failed to connect to peer', error));
    }
  }

  public disconnect(): void {
    this.dataChannelManager?.disconnect();
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.peerId = null;
    this.emit('disconnected');
  }

  public isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }

  public async sendFile(file: File): Promise<void> {
    if (!this.isConnected()) {
      throw new ConnectionError('Not connected to a peer');
    }
    await this.dataChannelManager?.sendFile(file);
  }

  public cancelTransfer(filename: string, isReceiver: boolean = false): void {
    this.dataChannelManager?.cancelTransfer(filename, isReceiver);
  }

  public setProgressCallback(callback: (progress: TransferProgress) => void): void {
    this.progressCallback = callback;
  }

  private handleProgress(progress: TransferProgress): void {
    this.progressCallback?.(progress);
    this.emit('progress', progress);
  }

  public setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void): void {
    this.connectionStateHandler = handler;
  }
}
