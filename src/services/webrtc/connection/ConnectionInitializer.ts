
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
    private localPeerCode: string
  ) {}

  async initializeConnection(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    const connectionPromise = new Promise<void>(async (resolve, reject) => {
      try {
        const peerConnection = await this.connectionManager.createPeerConnection();
        
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
          peerCode: this.localPeerCode
        }, remotePeerCode);

        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection.connectionState;
          if (state === 'connected') {
            console.log('[WEBRTC] Connection established successfully');
            resolve();
          } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
            reject(new ConnectionError("Connection failed or closed"));
          }
        };
      } catch (error) {
        reject(new ConnectionError("Failed to initiate connection", error));
      }
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new ConnectionError("Connection timeout"));
      }, 30000);
    });

    return Promise.race([connectionPromise, timeoutPromise]);
  }
}
