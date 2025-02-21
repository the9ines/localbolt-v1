
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
  private signalingService: SignalingService;
  private peerId: string | null = null;
  private encryptionService: EncryptionService;
  private progressCallback: ((progress: TransferProgress) => void) | null = null;
  private connectionStateHandler: ((state: RTCPeerConnectionState) => void) | null = null;

  constructor(
    private localPeerCode: string,
    private callbacks: WebRTCCallbacks,
    private config: WebRTCConfig = DEFAULT_CONFIG
  ) {
    super();
    this.encryptionService = new EncryptionService();
    this.signalingService = new SignalingService(this.localPeerCode, this.handleSignal.bind(this));
    this.initializeServices();
    this.setupSignalingHandlers();
  }

  private initializeServices(): void {
    this.dataChannelManager = new DataChannelManager(
      this.encryptionService,
      this.callbacks.onReceiveFile,
      this.handleProgress.bind(this),
      this.callbacks.onError
    );
  }

  private handleSignal = (signal: SignalData): void => {
    if (signal.to !== this.localPeerCode) return;
    console.log('[WEBRTC] Received signal:', signal.type, 'from:', signal.from);
    this.emit(signal.type, signal.data, signal.from);
  };

  private setupSignalingHandlers(): void {
    this.on('offer', this.handleOffer.bind(this));
    this.on('answer', this.handleAnswer.bind(this));
    this.on('ice-candidate', this.handleICECandidate.bind(this));
  }

  private handleOffer = async (offer: RTCSessionDescriptionInit, from: string): Promise<void> => {
    try {
      await this.createPeerConnection();
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      this.signalingService.sendAnswer(answer, from);
    } catch (error) {
      this.callbacks.onError(new ConnectionError('Failed to handle offer', error));
    }
  };

  private handleAnswer = async (answer: RTCSessionDescriptionInit): Promise<void> => {
    try {
      await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      this.callbacks.onError(new ConnectionError('Failed to handle answer', error));
    }
  };

  private handleICECandidate = async (candidate: RTCIceCandidateInit): Promise<void> => {
    try {
      await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      this.callbacks.onError(new ConnectionError('Failed to add ICE candidate', error));
    }
  };

  private handleICECandidateEvent = (event: RTCPeerConnectionIceEvent): void => {
    if (event.candidate && this.peerId) {
      this.signalingService.sendICECandidate(event.candidate, this.peerId);
    }
  };

  private handleICEConnectionStateChangeEvent = (): void => {
    console.log('[WEBRTC] ICE connection state:', this.peerConnection?.iceConnectionState);
  };

  private handleConnectionStateChangeEvent = (): void => {
    const state = this.peerConnection?.connectionState;
    console.log('[WEBRTC] Connection state:', state);
    this.connectionStateHandler?.(state as RTCPeerConnectionState);
  };

  private handleDataChannel = (event: RTCDataChannelEvent): void => {
    this.dataChannelManager?.setupDataChannel(event.channel);
  };

  private async createPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(this.config);
    this.setupPeerConnectionHandlers();
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = this.handleICECandidateEvent;
    this.peerConnection.oniceconnectionstatechange = this.handleICEConnectionStateChangeEvent;
    this.peerConnection.onconnectionstatechange = this.handleConnectionStateChangeEvent;
    this.peerConnection.ondatachannel = this.handleDataChannel;
  }

  public getRemotePeerCode(): string | null {
    return this.peerId;
  }

  public async connectToPeer(peerId: string): Promise<void> {
    this.peerId = peerId;
    try {
      await this.createPeerConnection();
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      this.signalingService.sendOffer(offer, peerId);
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
