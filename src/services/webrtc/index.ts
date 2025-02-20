
import { box } from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { SignalData, WebRTCError, WebRTCErrorCode, TransferProgress } from './types';
import { EncryptionService } from './encryption';
import { SignalingService } from './signaling';
import { ConnectionService } from './connection';
import { TransferService } from './transfer';
import { DataChannelService } from './datachannel';

class WebRTCService {
  private connectionService: ConnectionService;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private transferService: TransferService;
  private dataChannelService: DataChannelService;
  private remotePeerCode: string = '';
  private connectionTimeout: number = 30000; // 30 seconds timeout

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    try {
      const keyPair = box.keyPair();
      this.encryptionService = new EncryptionService(keyPair);
      this.transferService = new TransferService(
        this.encryptionService,
        this.onReceiveFile,
        this.onError,
        this.onProgress
      );
      this.dataChannelService = new DataChannelService(this.transferService, this.onError);
      this.connectionService = new ConnectionService();
      this.signalingService = new SignalingService(localPeerCode, this.handleSignal.bind(this));
    } catch (error) {
      const webRTCError = new WebRTCError(
        'Failed to initialize WebRTC service',
        WebRTCErrorCode.INVALID_STATE,
        error
      );
      console.error('[INIT] Error:', webRTCError);
      this.onError(webRTCError);
    }
  }

  private async handleSignal(signal: SignalData) {
    console.log(`[SIGNALING] Processing ${signal.type} from peer ${signal.from}`);
    try {
      const peerConnection = await this.ensurePeerConnection();

      if (signal.type === 'offer') {
        this.remotePeerCode = signal.from;
        try {
          this.encryptionService.setRemotePeerPublicKey(decodeBase64(signal.data.publicKey));
        } catch (error) {
          throw new WebRTCError(
            'Failed to set remote peer public key',
            WebRTCErrorCode.ENCRYPTION_FAILED,
            error
          );
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('[SIGNALING] Created and sent answer');
        
        await this.signalingService.sendSignal('answer', {
          answer,
          publicKey: encodeBase64(this.encryptionService.getPublicKey())
        }, signal.from);

      } else if (signal.type === 'answer') {
        try {
          this.encryptionService.setRemotePeerPublicKey(decodeBase64(signal.data.publicKey));
        } catch (error) {
          throw new WebRTCError(
            'Failed to set remote peer public key from answer',
            WebRTCErrorCode.ENCRYPTION_FAILED,
            error
          );
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.answer));

      } else if (signal.type === 'ice-candidate') {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(signal.data));
          console.log('[ICE] Added ICE candidate successfully');
        } catch (error) {
          throw new WebRTCError(
            'Failed to add ICE candidate',
            WebRTCErrorCode.CONNECTION_FAILED,
            error
          );
        }
      }
    } catch (error) {
      const webRTCError = error instanceof WebRTCError ? error : new WebRTCError(
        'Failed to process signal',
        WebRTCErrorCode.SIGNALING_FAILED,
        error
      );
      console.error('[SIGNALING] Error:', webRTCError);
      this.onError(webRTCError);
    }
  }

  private async ensurePeerConnection(): Promise<RTCPeerConnection> {
    try {
      const existing = this.connectionService.getPeerConnection();
      if (existing) return existing;

      const peerConnection = await this.connectionService.createPeerConnection();
      
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[ICE] New ICE candidate generated');
          this.signalingService.sendSignal('ice-candidate', event.candidate, this.remotePeerCode)
            .catch(error => {
              const webRTCError = new WebRTCError(
                'Failed to send ICE candidate',
                WebRTCErrorCode.SIGNALING_FAILED,
                error
              );
              console.error('[ICE] Error:', webRTCError);
              this.onError(webRTCError);
            });
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log('[ICE] Connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed' || 
            peerConnection.iceConnectionState === 'disconnected') {
          const webRTCError = new WebRTCError(
            `ICE connection ${peerConnection.iceConnectionState}`,
            WebRTCErrorCode.CONNECTION_FAILED
          );
          console.error('[ICE] Error:', webRTCError);
          this.onError(webRTCError);
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log('[WEBRTC] Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'failed' || 
            peerConnection.connectionState === 'closed') {
          const webRTCError = new WebRTCError(
            `Connection ${peerConnection.connectionState}`,
            WebRTCErrorCode.CONNECTION_FAILED
          );
          console.error('[WEBRTC] Error:', webRTCError);
          this.onError(webRTCError);
        }
      };

      peerConnection.ondatachannel = (event) => {
        console.log('[DATACHANNEL] Received data channel');
        this.dataChannelService.setupDataChannel(event.channel);
      };

      return peerConnection;
    } catch (error) {
      const webRTCError = new WebRTCError(
        'Failed to create peer connection',
        WebRTCErrorCode.CONNECTION_FAILED,
        error
      );
      console.error('[WEBRTC] Error:', webRTCError);
      this.onError(webRTCError);
      throw webRTCError;
    }
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    try {
      this.remotePeerCode = remotePeerCode;
      const peerConnection = await this.ensurePeerConnection();

      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true,
        maxRetransmits: 3
      });
      
      this.dataChannelService.setupDataChannel(dataChannel);

      const connectionPromise = new Promise<void>(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new WebRTCError(
            'Connection timed out',
            WebRTCErrorCode.CONNECTION_FAILED
          ));
        }, this.connectionTimeout);

        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          console.log('[SIGNALING] Created and sent offer');
          
          await this.signalingService.sendSignal('offer', {
            offer,
            publicKey: encodeBase64(this.encryptionService.getPublicKey())
          }, remotePeerCode);

          // Wait for data channel to open
          if (dataChannel.readyState !== 'open') {
            await new Promise<void>((res, rej) => {
              const openTimeout = setTimeout(() => {
                rej(new WebRTCError('Data channel failed to open', WebRTCErrorCode.CONNECTION_FAILED));
              }, 10000);
              
              dataChannel.onopen = () => {
                clearTimeout(openTimeout);
                res();
              };
            });
          }

          clearTimeout(timeoutId);
          resolve();
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      await connectionPromise;
    } catch (error) {
      const webRTCError = error instanceof WebRTCError ? error : new WebRTCError(
        'Failed to establish connection',
        WebRTCErrorCode.CONNECTION_FAILED,
        error
      );
      console.error('[WEBRTC] Error:', webRTCError);
      this.onError(webRTCError);
      throw webRTCError;
    }
  }

  async sendFile(file: File) {
    const dataChannel = this.dataChannelService.getDataChannel();
    if (!dataChannel) {
      throw new WebRTCError(
        'No connection established',
        WebRTCErrorCode.INVALID_STATE
      );
    }
    await this.transferService.sendFile(dataChannel, file);
  }

  async cancelTransfer(filename: string) {
    const dataChannel = this.dataChannelService.getDataChannel();
    if (!dataChannel) {
      throw new WebRTCError(
        'No connection established',
        WebRTCErrorCode.INVALID_STATE
      );
    }
    await this.transferService.cancelTransfer(dataChannel, filename);
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting peer connection');
    this.dataChannelService.close();
    this.connectionService.disconnect();
  }
}

export default WebRTCService;
