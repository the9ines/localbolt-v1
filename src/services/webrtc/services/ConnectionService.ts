
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { ConnectionManager } from '../ConnectionManager';
import { DataChannelManager } from '../DataChannelManager';
import { SignalingService } from '../SignalingService';
import { EncryptionService } from '../EncryptionService';
import { WebRTCStateManager } from '../managers/WebRTCStateManager';

export class ConnectionService {
  constructor(
    private connectionManager: ConnectionManager,
    private dataChannelManager: DataChannelManager,
    private signalingService: SignalingService,
    private encryptionService: EncryptionService,
    private stateManager: WebRTCStateManager
  ) {}

  async connect(remotePeerCode: string): Promise<void> {
    try {
      this.stateManager.setRemotePeerCode(remotePeerCode);
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
        console.log('[WEBRTC] Connection state changed:', state);
        this.stateManager.handleConnectionStateChange(state);
      };

    } catch (error) {
      this.stateManager.handleDisconnection();
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    }
  }

  disconnect() {
    console.log('[WEBRTC] Manual disconnect initiated');
    this.dataChannelManager.disconnect();
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    
    const remotePeerCode = this.stateManager.getRemotePeerCode();
    if (remotePeerCode) {
      this.signalingService.sendSignal('disconnect', {}, remotePeerCode)
        .catch(console.error);
    }
    
    this.stateManager.handleDisconnection();
  }
}
