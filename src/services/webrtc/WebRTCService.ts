
import { SignalingService, SignalData } from './SignalingService';
import { DataChannelManager, IDataChannelManager } from './DataChannelManager';
import { EncryptionService } from './EncryptionService';
import { ConnectionError, SignalingError, TransferError, TransferErrorCode, WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './types/transfer';

interface ICECandidate {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
}

export interface IWebRTCService {
  connectToPeer: (peerId: string) => Promise<void>;
  disconnect: () => void;
  isConnected: () => boolean;
  sendFile: (file: File) => Promise<void>;
  cancelTransfer: (filename: string, isReceiver?: boolean) => void;
  setProgressCallback: (callback: (progress: TransferProgress) => void) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback: (...args: any[]) => void) => void;
}

export default class WebRTCService implements IWebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannelManager: IDataChannelManager | null = null;
  private signalingService: SignalingService;
  private peerId: string | null = null;
  private encryptionService: EncryptionService;
  private eventListeners: { [event: string]: ((...args: any[]) => void)[] } = {};
  private progressCallback: ((progress: TransferProgress) => void) | null = null;
  private connectionStateHandler: ((state: RTCPeerConnectionState) => void) | null = null;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void
  ) {
    this.encryptionService = new EncryptionService();
    this.signalingService = new SignalingService(localPeerCode, this.handleSignal.bind(this));
    this.setupSignalingHandlers();
  }

  private handleSignal = (signal: SignalData) => {
    if (signal.to !== this.localPeerCode) return;
    
    console.log('[WEBRTC] Received signal:', signal.type, 'from:', signal.from);
    switch (signal.type) {
      case 'offer':
        this.emit('offer', signal.data.offer, signal.from);
        break;
      case 'answer':
        this.emit('answer', signal.data.answer, signal.from);
        break;
      case 'ice-candidate':
        this.emit('ice-candidate', signal.data, signal.from);
        break;
      default:
        console.warn('[WEBRTC] Unknown signal type:', signal.type);
    }
  };

  private setupSignalingHandlers() {
    this.on('offer', this.handleOffer);
    this.on('answer', this.handleAnswer);
    this.on('ice-candidate', this.handleICECandidate);
    this.on('peer-disconnected', this.handlePeerDisconnected);
  }

  private async createPeerConnection() {
    const config: RTCConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    this.peerConnection = new RTCPeerConnection(config);
    this.peerConnection.onicecandidate = this.handleICECandidateEvent;
    this.peerConnection.oniceconnectionstatechange = this.handleICEConnectionStateChangeEvent;
    this.peerConnection.onconnectionstatechange = this.handleConnectionStateChangeEvent;
    this.peerConnection.ondatachannel = this.handleDataChannel;
  }

  public getRemotePeerCode(): string | null {
    return this.peerId;
  }

  public setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateHandler = handler;
  }

  private handleOffer = async (offer: RTCSessionDescriptionInit, peerId: string) => {
    try {
      this.peerId = peerId;
      await this.createPeerConnection();
      await this.peerConnection!.setRemoteDescription(offer);
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      this.signalingService.sendAnswer(answer, peerId);
    } catch (error) {
      console.error('[WEBRTC] Error handling offer:', error);
      this.emitError(new SignalingError('Failed to handle offer', error));
    }
  };

  private handleAnswer = async (answer: RTCSessionDescriptionInit, peerId: string) => {
    try {
      await this.peerConnection!.setRemoteDescription(answer);
    } catch (error) {
      console.error('[WEBRTC] Error handling answer:', error);
      this.emitError(new SignalingError('Failed to handle answer', error));
    }
  };

  private handleICECandidate = (candidate: RTCIceCandidate) => {
    this.signalingService.sendICECandidate(candidate, this.peerId!);
  };

  private handlePeerDisconnected = (peerId: string) => {
    if (this.peerId === peerId) {
      this.disconnect();
    }
  };

  private handleDataChannelError = (event: Event) => {
    console.error('[WEBRTC] Data channel error:', event);
    this.emitError(new TransferError(
      "Data channel error occurred",
      TransferErrorCode.NETWORK_ERROR,
      { event }
    ));
  };

  private handleICECandidateEvent = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      this.signalingService.sendICECandidate(event.candidate, this.peerId!);
    }
  };

  private handleICEConnectionStateChangeEvent = () => {
    console.log(`[WEBRTC] ICE connection state changed to: ${this.peerConnection!.iceConnectionState}`);
    this.emit('ice-connection-state-change', this.peerConnection!.iceConnectionState);
  };

  private handleConnectionStateChangeEvent = () => {
    console.log(`[WEBRTC] Connection state changed to: ${this.peerConnection!.connectionState}`);
    this.emit('connection-state-change', this.peerConnection!.connectionState);
  };

  private handleDataChannel = (event: RTCDataChannelEvent) => {
    const dataChannel = event.channel;
    console.log('[WEBRTC] Data channel created by remote peer');

    this.dataChannelManager = new DataChannelManager(
      this.encryptionService,
      this.onReceiveFile,
      (progress: TransferProgress) => {
        this.progressCallback?.(progress);
        this.emit('progress', progress);
      },
      (error: WebRTCError) => {
        this.emitError(error);
      }
    );

    this.dataChannelManager.setStateChangeHandler((state: RTCDataChannelState) => {
      this.emit('data-channel-state-change', state);
    });

    this.dataChannelManager.setupDataChannel(dataChannel);
  };

  public async connectToPeer(peerId: string): Promise<void> {
    this.peerId = peerId;
    try {
      await this.createPeerConnection();
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      this.signalingService.sendOffer(offer, peerId);
    } catch (error) {
      console.error('[WEBRTC] Error connecting to peer:', error);
      this.emitError(new SignalingError('Failed to connect to peer', error));
    }
  }

  private createDataChannel(): void {
    console.log('[WEBRTC] Creating data channel');
    const dataChannel = this.peerConnection!.createDataChannel('file-transfer', {
      ordered: false,
      maxRetransmits: 0,
    });

    this.dataChannelManager = new DataChannelManager(
      this.encryptionService,
      this.onReceiveFile,
      (progress: TransferProgress) => {
        this.progressCallback?.(progress);
        this.emit('progress', progress);
      },
      (error: WebRTCError) => {
        this.emitError(error);
      }
    );

    this.dataChannelManager.setStateChangeHandler((state: RTCDataChannelState) => {
      this.emit('data-channel-state-change', state);
    });

    this.dataChannelManager.setupDataChannel(dataChannel);
  }

  private handleTransferError(error: any) {
    console.error('[WEBRTC] Transfer error:', error);
    if (error instanceof TransferError) {
      this.emitError(error);
    } else {
      this.emitError(new TransferError(
        "Transfer failed",
        TransferErrorCode.NETWORK_ERROR,
        { error }
      ));
    }
  }

  public async sendFile(file: File): Promise<void> {
    if (!this.isConnected()) {
      throw new ConnectionError('Not connected to a peer');
    }

    if (!this.dataChannelManager) {
      this.createDataChannel();
    }

    try {
      await this.dataChannelManager.sendFile(file);
    } catch (error: any) {
      this.handleTransferError(error);
    }
  }

  public disconnect = (): void => {
    console.log('[WEBRTC] Disconnecting from peer');
    this.signalingService.off('offer', this.handleOffer);
    this.signalingService.off('answer', this.handleAnswer);
    this.signalingService.off('ice-candidate', this.handleICECandidate);
    this.signalingService.off('peer-disconnected', this.handlePeerDisconnected);

    try {
      if (this.dataChannelManager) {
        this.dataChannelManager.disconnect();
        this.dataChannelManager = null;
      }

      if (this.peerConnection) {
        this.peerConnection.onicecandidate = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.ondatachannel = null;
        this.peerConnection.close();
        this.peerConnection = null;
      }
    } catch (error) {
      this.emitError(new TransferError(
        "Error during disconnect",
        TransferErrorCode.NETWORK_ERROR,
        { error }
      ));
    }

    this.peerId = null;
    this.emit('disconnected');
  };

  public isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }

  public setProgressCallback(callback: (progress: TransferProgress) => void): void {
    this.progressCallback = callback;
  }

  public cancelTransfer(filename: string, isReceiver: boolean = false): void {
    this.dataChannelManager?.cancelTransfer(filename, isReceiver);
  }

  public on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  public off(event: string, callback: (...args: any[]) => void): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  private emit(event: string, ...args: any[]): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(...args));
    }
  }

  private emitError(error: WebRTCError): void {
    this.emit('error', error);
  }
}
