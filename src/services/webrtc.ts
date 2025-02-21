
import { SignalingService } from './webrtc/SignalingService';
import { DataChannelManager, IDataChannelManager } from './webrtc/DataChannelManager';
import { EncryptionService } from './webrtc/EncryptionService';
import { ConnectionError, SignalingError, TransferError, TransferErrorCode, WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from './webrtc/types/transfer';

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

  constructor(
    signalingService: SignalingService,
    private onReceiveFile: (file: Blob, filename: string) => void
  ) {
    this.signalingService = signalingService;
    this.encryptionService = new EncryptionService();

    this.signalingService.on('offer', this.handleOffer);
    this.signalingService.on('answer', this.handleAnswer);
    this.signalingService.on('ice-candidate', this.handleICECandidate);
    this.signalingService.on('peer-disconnected', this.handlePeerDisconnected);

    console.log('[WEBRTC] Initialized WebRTCService');
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
    this.eventListeners[event]?.forEach(callback => callback(...args));
  }

  private emitError(error: WebRTCError): void {
    this.emit('error', error);
  }

  public setProgressCallback(callback: (progress: TransferProgress) => void): void {
    this.progressCallback = callback;
  }

  private handlePeerDisconnected = (peerId: string) => {
    if (this.peerId === peerId) {
      console.log(`[WEBRTC] Peer ${peerId} disconnected`);
      this.disconnect();
      this.emit('peer-disconnected', peerId);
    }
  };

  private handleOffer = async (offer: RTCSessionDescriptionInit, peerId: string) => {
    console.log(`[WEBRTC] Received offer from ${peerId}`);
    this.peerId = peerId;
    try {
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

  private handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    console.log('[WEBRTC] Received answer');
    try {
      await this.peerConnection!.setRemoteDescription(answer);
    } catch (error) {
      console.error('[WEBRTC] Error handling answer:', error);
      this.emitError(new SignalingError('Failed to handle answer', error));
    }
  };

  private handleICECandidate = async (iceCandidate: ICECandidate) => {
    try {
      await this.peerConnection!.addIceCandidate(iceCandidate);
    } catch (error) {
      console.error('[WEBRTC] Error adding ICE candidate:', error);
      // It's possible that the ICE candidate is not compatible, but the connection can still succeed
      // so we don't want to throw an error here.
      // this.emitError(new SignalingError('Failed to add ICE candidate', error));
    }
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

  private async createPeerConnection(): Promise<void> {
    if (this.peerConnection) {
      console.warn('[WEBRTC] Peer connection already exists');
      return;
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ],
    });

    this.peerConnection.onicecandidate = this.handleICECandidateEvent;
    this.peerConnection.oniceconnectionstatechange = this.handleICEConnectionStateChangeEvent;
    this.peerConnection.onconnectionstatechange = this.handleConnectionStateChangeEvent;
    this.peerConnection.ondatachannel = this.handleDataChannel;

    console.log('[WEBRTC] Created RTCPeerConnection');
  }

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

  private createDataChannel(): void {
    console.log('[WEBRTC] Creating data channel');
    const dataChannel = this.peerConnection!.createDataChannel('file-transfer', {
      ordered: false, // Do not guarantee order
      maxRetransmits: 0, // Do not retransmit
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

  private handleDataChannelError(event: Event) {
    console.error('[WEBRTC] Data channel error:', event);
    this.emitError(new TransferError(
      "Data channel error occurred",
      TransferErrorCode.NETWORK_ERROR,
      event
    ));
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

  private handleTransferError(error: any) {
    console.error('[WEBRTC] Transfer error:', error);
    if (error instanceof TransferError) {
      this.emitError(error);
    } else {
      this.emitError(new TransferError(
        "Transfer failed",
        TransferErrorCode.NETWORK_ERROR,
        error
      ));
    }
  }

  public cancelTransfer(filename: string, isReceiver: boolean = false): void {
    this.dataChannelManager?.cancelTransfer(filename, isReceiver);
  }

  public isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
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
        "File transfer failed",
        TransferErrorCode.NETWORK_ERROR,
        error
      ));
    }

    this.peerId = null;
    this.emit('disconnected');
  };
}
