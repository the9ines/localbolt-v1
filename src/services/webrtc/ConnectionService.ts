
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { ConnectionManager } from './ConnectionManager';
import { SignalingService } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { DataChannelManager } from './DataChannelManager';

export class ConnectionService {
  private remotePeerCode: string = '';

  constructor(
    private connectionManager: ConnectionManager,
    private signalingService: SignalingService,
    private encryptionService: EncryptionService,
    private dataChannelManager: DataChannelManager,
    private localPeerCode: string
  ) {}

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    const connectionPromise = new Promise<void>((resolve, reject) => {
      this.remotePeerCode = remotePeerCode;
      
      this.connectionManager.createPeerConnection()
        .then(peerConnection => {
          this.dataChannelManager.setupDataChannel(
            peerConnection.createDataChannel('fileTransfer', {
              ordered: true,
              maxRetransmits: 3
            })
          );
          
          return peerConnection.createOffer();
        })
        .then(offer => {
          const peerConnection = this.connectionManager.getPeerConnection();
          if (!peerConnection) {
            throw new ConnectionError("No peer connection available");
          }
          
          return peerConnection.setLocalDescription(offer)
            .then(() => {
              console.log('[SIGNALING] Created and set local description (offer)');
              return this.signalingService.sendSignal('offer', {
                offer,
                publicKey: this.encryptionService.getPublicKey(),
                peerCode: this.localPeerCode
              }, remotePeerCode);
            });
        })
        .then(() => {
          const peerConnection = this.connectionManager.getPeerConnection();
          if (!peerConnection) {
            throw new ConnectionError("No peer connection available");
          }

          peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            if (state === 'connected') {
              console.log('[WEBRTC] Connection established successfully');
              resolve();
            } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
              console.log('[WEBRTC] Connection state changed to:', state);
              reject(new ConnectionError("Connection failed or closed"));
            }
          };
        })
        .catch(error => {
          reject(new ConnectionError("Failed to initiate connection", error));
        });
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new ConnectionError("Connection timeout"));
      }, 30000);
    });

    try {
      await Promise.race([connectionPromise, timeoutPromise]);
    } catch (error) {
      this.disconnect();
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    }
  }

  disconnect(): void {
    console.log('[WEBRTC] Disconnecting connection service');
    this.connectionManager.disconnect();
    this.encryptionService.reset();
    this.remotePeerCode = '';
  }

  getRemotePeerCode(): string {
    return this.remotePeerCode;
  }
}
