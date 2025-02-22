
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { ConnectionManager } from '../ConnectionManager';
import { SignalingService } from '../SignalingService';
import { EncryptionService } from '../EncryptionService';
import { DataChannelManager } from '../DataChannelManager';

export class ConnectionInitializer {
  constructor(
    private connectionManager: ConnectionManager,
    private signalingService: SignalingService,
    private encryptionService: EncryptionService,
    private dataChannelManager: DataChannelManager,
    private onStateChange: (state: RTCPeerConnectionState) => void
  ) {}

  async initializeConnection(remotePeerCode: string, localPeerCode: string, isInitiator: boolean): Promise<void> {
    if (!isInitiator) {
      console.log('[WEBRTC] Not initiator, waiting for offer from peer');
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (!this.connectionManager.getPeerConnection()?.remoteDescription) {
            reject(new ConnectionError("No offer received"));
          }
        }, 10000);
      });
    }

    const peerConnection = await this.connectionManager.createPeerConnection();
    
    peerConnection.oniceconnectionstatechange = () => {
      console.log('[ICE] Connection state changed:', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'disconnected') {
        this.onStateChange('disconnected');
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
      peerCode: localPeerCode
    }, remotePeerCode);

    return new Promise((resolve, reject) => {
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('[WEBRTC] Connection state changed to:', state);
        
        if (state === 'connected') {
          console.log('[WEBRTC] Connection established successfully');
          resolve();
        } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          console.log('[WEBRTC] Connection state changed to:', state);
          reject(new ConnectionError("Connection failed or closed"));
        }
      };
    });
  }
}
