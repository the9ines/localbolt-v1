
import { ConnectionError } from '@/types/webrtc-errors';
import { ConnectionManager } from '../ConnectionManager';
import { DataChannelManager } from '../DataChannelManager';
import { SignalingService } from '../SignalingService';
import { EncryptionService } from '../EncryptionService';

export class ConnectionInitializer {
  constructor(
    private connectionManager: ConnectionManager,
    private dataChannelManager: DataChannelManager,
    private signalingService: SignalingService,
    private encryptionService: EncryptionService,
    private onStateChange: (state: RTCPeerConnectionState) => void
  ) {}

  async initializeConnection(remotePeerCode: string): Promise<RTCPeerConnection> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
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
      this.onStateChange(state);
    };

    return peerConnection;
  }
}
