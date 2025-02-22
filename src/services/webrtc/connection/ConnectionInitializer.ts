
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import { ConnectionManager } from '../ConnectionManager';
import { SignalingService } from '../SignalingService';
import { EncryptionService } from '../EncryptionService';
import { DataChannelManager } from '../DataChannelManager';

export class ConnectionInitializer {
  private offerTimeout: NodeJS.Timeout | null = null;
  private readonly OFFER_TIMEOUT = 20000; // 20 seconds

  constructor(
    private connectionManager: ConnectionManager,
    private signalingService: SignalingService,
    private encryptionService: EncryptionService,
    private dataChannelManager: DataChannelManager,
    private onStateChange: (state: RTCPeerConnectionState) => void
  ) {}

  async initializeConnection(remotePeerCode: string, localPeerCode: string, isInitiator: boolean): Promise<void> {
    console.log('[WEBRTC] Initializing connection as', isInitiator ? 'initiator' : 'receiver');
    
    const peerConnection = await this.connectionManager.createPeerConnection();
    
    // Set up ICE connection state monitoring for both initiator and receiver
    peerConnection.oniceconnectionstatechange = () => {
      console.log('[ICE] Connection state changed:', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'disconnected') {
        this.onStateChange('disconnected');
      }
    };

    // Common connection state monitoring
    const connectionPromise = new Promise<void>((resolve, reject) => {
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('[WEBRTC] Connection state changed to:', state);
        
        if (state === 'connected') {
          console.log('[WEBRTC] Connection established successfully');
          if (this.offerTimeout) {
            clearTimeout(this.offerTimeout);
            this.offerTimeout = null;
          }
          resolve();
        } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          console.log('[WEBRTC] Connection failed:', state);
          reject(new ConnectionError(`Connection ${state}`));
        }
      };
    });

    if (isInitiator) {
      console.log('[WEBRTC] Creating and sending offer');
      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true,
        maxRetransmits: 3
      });
      
      this.dataChannelManager.setupDataChannel(dataChannel);
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      await this.signalingService.sendSignal('offer', {
        offer,
        publicKey: this.encryptionService.getPublicKey(),
        peerCode: localPeerCode
      }, remotePeerCode);
      
    } else {
      console.log('[WEBRTC] Waiting for offer from peer');
      // Set up a timeout for receiving the offer
      const offerPromise = new Promise<void>((resolve, reject) => {
        this.offerTimeout = setTimeout(() => {
          reject(new ConnectionError("No offer received within timeout"));
        }, this.OFFER_TIMEOUT);

        // The promise will be resolved when the SignalingHandler receives and processes the offer
        peerConnection.ondatachannel = (event) => {
          console.log('[WEBRTC] Received data channel');
          this.dataChannelManager.setupDataChannel(event.channel);
          if (this.offerTimeout) {
            clearTimeout(this.offerTimeout);
            this.offerTimeout = null;
          }
          resolve();
        };
      });

      try {
        await Promise.race([offerPromise, connectionPromise]);
      } catch (error) {
        if (this.offerTimeout) {
          clearTimeout(this.offerTimeout);
          this.offerTimeout = null;
        }
        throw error;
      }
    }

    return connectionPromise;
  }
}
