
import { ConnectionError, WebRTCError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { FileTransferService } from './FileTransferService';

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private remotePeerCode: string = '';
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private connectionTimeout: number = 30000; // 30 seconds timeout
  
  private signalingService: SignalingService;
  private encryptionService: EncryptionService;
  private fileTransferService: FileTransferService | null = null;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    this.encryptionService = new EncryptionService();
    this.signalingService = new SignalingService(localPeerCode, this.handleSignal.bind(this));
  }

  private async handleSignal(signal: SignalData) {
    if (signal.to !== this.localPeerCode) return;
    console.log('[SIGNALING] Processing signal:', signal.type, 'from:', signal.from);

    try {
      if (signal.type === 'offer') {
        await this.handleOffer(signal);
      } else if (signal.type === 'answer') {
        await this.handleAnswer(signal);
      } else if (signal.type === 'ice-candidate') {
        await this.handleIceCandidate(signal);
      }
    } catch (error) {
      console.error('[SIGNALING] Handler error:', error);
      this.onError(error as WebRTCError);
    }
  }

  private async handleOffer(signal: SignalData) {
    console.log('[SIGNALING] Received offer from peer:', signal.from);
    this.remotePeerCode = signal.from;
    this.encryptionService.setRemotePublicKey(signal.data.publicKey);
    await this.createPeerConnection();
    
    const offerDesc = new RTCSessionDescription(signal.data.offer);
    await this.peerConnection!.setRemoteDescription(offerDesc);
    console.log('[SIGNALING] Set remote description (offer)');
    
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    console.log('[SIGNALING] Created and sending answer');
    
    await this.signalingService.sendSignal('answer', {
      answer,
      publicKey: this.encryptionService.getPublicKey()
    }, signal.from);

    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      await this.peerConnection!.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[ICE] Added pending ICE candidate');
    }
  }

  private async handleAnswer(signal: SignalData) {
    console.log('[SIGNALING] Received answer from peer:', signal.from);
    this.encryptionService.setRemotePublicKey(signal.data.publicKey);
    
    if (!this.peerConnection) {
      throw new ConnectionError("No peer connection established");
    }

    if (this.peerConnection.signalingState === 'have-local-offer') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
      console.log('[SIGNALING] Set remote description (answer)');
      
      while (this.pendingIceCandidates.length > 0) {
        const candidate = this.pendingIceCandidates.shift();
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[ICE] Added pending ICE candidate');
      }
    } else {
      throw new ConnectionError(
        "Received answer in invalid state",
        { state: this.peerConnection.signalingState }
      );
    }
  }

  private async handleIceCandidate(signal: SignalData) {
    if (!this.peerConnection) {
      console.log('[ICE] Queuing ICE candidate (no peer connection)');
      this.pendingIceCandidates.push(signal.data);
      return;
    }

    const signalingState = this.peerConnection.signalingState;
    if (signalingState === 'stable' || signalingState === 'have-remote-offer' || signalingState === 'have-local-offer') {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.data));
      console.log('[ICE] Added ICE candidate');
    } else {
      console.log('[ICE] Queuing ICE candidate (invalid state)');
      this.pendingIceCandidates.push(signal.data);
    }
  }

  private async createPeerConnection() {
    console.log('[WEBRTC] Creating peer connection');
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[ICE] New ICE candidate generated:', event.candidate.candidate);
        this.signalingService.sendSignal('ice-candidate', event.candidate, this.remotePeerCode)
          .catch(error => {
            console.error('[ICE] Failed to send candidate:', error);
            this.onError(error as WebRTCError);
          });
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[ICE] Connection state:', state);
      
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.onError(new ConnectionError("ICE connection failed", { state }));
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WEBRTC] Connection state:', state);
      
      if (state === 'failed' || state === 'closed') {
        this.onError(new ConnectionError("WebRTC connection failed", { state }));
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      console.log('[DATACHANNEL] Received data channel');
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    return this.peerConnection;
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    console.log('[DATACHANNEL] Setting up data channel');
    
    this.dataChannel.onopen = () => {
      console.log('[DATACHANNEL] Channel opened');
    };

    this.dataChannel.onclose = () => {
      console.log('[DATACHANNEL] Channel closed');
      this.fileTransferService = null;
    };

    this.dataChannel.onerror = (error) => {
      console.error('[DATACHANNEL] Error:', error);
      this.onError(new ConnectionError("Data channel error", error));
    };

    this.fileTransferService = new FileTransferService(
      this.dataChannel,
      this.encryptionService,
      this.onReceiveFile
    );
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    const connectionPromise = new Promise<void>(async (resolve, reject) => {
      try {
        this.remotePeerCode = remotePeerCode;
        await this.createPeerConnection();

        this.dataChannel = this.peerConnection!.createDataChannel('fileTransfer');
        this.setupDataChannel();

        const offer = await this.peerConnection!.createOffer();
        await this.peerConnection!.setLocalDescription(offer);
        console.log('[SIGNALING] Created and set local description (offer)');
        
        await this.signalingService.sendSignal('offer', {
          offer,
          publicKey: this.encryptionService.getPublicKey()
        }, remotePeerCode);

        const checkConnection = () => {
          if (this.peerConnection?.connectionState === 'connected') {
            resolve();
          } else if (this.peerConnection?.connectionState === 'failed') {
            reject(new ConnectionError("Connection failed"));
          }
        };

        this.peerConnection!.onconnectionstatechange = checkConnection;
        checkConnection();
      } catch (error) {
        reject(new ConnectionError("Failed to initiate connection", error));
      }
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new ConnectionError("Connection timeout"));
      }, this.connectionTimeout);
    });

    try {
      await Promise.race([connectionPromise, timeoutPromise]);
    } catch (error) {
      this.disconnect();
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    }
  }

  async sendFile(file: File) {
    if (!this.fileTransferService) {
      throw new ConnectionError("No connection established");
    }
    await this.fileTransferService.sendFile(file);
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting');
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this.dataChannel = null;
    this.peerConnection = null;
    this.fileTransferService = null;
    this.encryptionService.reset();
  }
}

export default WebRTCService;
