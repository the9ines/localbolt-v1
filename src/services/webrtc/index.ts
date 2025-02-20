import { box } from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { SignalData, FileChunkMessage, WebRTCError, WebRTCErrorCode, TransferProgress } from './types';
import { EncryptionService } from './encryption';
import { SignalingService } from './signaling';
import { ConnectionService } from './connection';

class WebRTCService {
  private connectionService: ConnectionService;
  private encryptionService: EncryptionService;
  private signalingService: SignalingService;
  private dataChannel: RTCDataChannel | null = null;
  private remotePeerCode: string = '';
  private chunksBuffer: { [key: string]: Blob[] } = {};
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
        this.dataChannel = event.channel;
        this.setupDataChannel();
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

  private setupDataChannel() {
    if (!this.dataChannel) return;

    console.log('[DATACHANNEL] Setting up data channel');
    this.dataChannel.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data) as FileChunkMessage;
        console.log(`[TRANSFER] Receiving chunk ${message.chunkIndex + 1}/${message.totalChunks} for ${message.filename}`);
        
        if (!this.chunksBuffer[message.filename]) {
          console.log(`[TRANSFER] Starting new transfer for ${message.filename}`);
          this.chunksBuffer[message.filename] = [];
        }

        try {
          const encryptedChunk = Uint8Array.from(atob(message.chunk), c => c.charCodeAt(0));
          const decryptedChunk = await this.encryptionService.decryptChunk(encryptedChunk);
          this.chunksBuffer[message.filename][message.chunkIndex] = new Blob([decryptedChunk]);

          if (this.onProgress) {
            const chunksReceived = this.chunksBuffer[message.filename].filter(Boolean).length;
            const bytesTransferred = chunksReceived * 16384; // Approximate for progress
            const progress: TransferProgress = {
              filename: message.filename,
              bytesTransferred: Math.min(bytesTransferred, message.fileSize),
              totalBytes: message.fileSize,
              percent: (chunksReceived / message.totalChunks) * 100,
              type: 'download'
            };
            this.onProgress(progress);
          }

          if (this.chunksBuffer[message.filename].filter(Boolean).length === message.totalChunks) {
            console.log(`[TRANSFER] Completed transfer of ${message.filename}`);
            const file = new Blob(this.chunksBuffer[message.filename]);
            delete this.chunksBuffer[message.filename];
            this.onReceiveFile(file, message.filename);
          }
        } catch (error) {
          throw new WebRTCError(
            'Failed to decrypt received chunk',
            WebRTCErrorCode.DECRYPTION_FAILED,
            error
          );
        }
      } catch (error) {
        const webRTCError = error instanceof WebRTCError ? error : new WebRTCError(
          'Failed to process received message',
          WebRTCErrorCode.TRANSFER_FAILED,
          error
        );
        console.error('[TRANSFER] Error:', webRTCError);
        this.onError(webRTCError);
      }
    };

    this.dataChannel.onerror = (error) => {
      const webRTCError = new WebRTCError(
        'Data channel error',
        WebRTCErrorCode.NETWORK_ERROR,
        error
      );
      console.error('[DATACHANNEL] Error:', webRTCError);
      this.onError(webRTCError);
    };

    this.dataChannel.onclose = () => {
      console.log('[DATACHANNEL] Channel closed');
      const webRTCError = new WebRTCError(
        'Data channel closed unexpectedly',
        WebRTCErrorCode.PEER_DISCONNECTED
      );
      this.onError(webRTCError);
    };
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    try {
      this.remotePeerCode = remotePeerCode;
      const peerConnection = await this.ensurePeerConnection();

      this.dataChannel = peerConnection.createDataChannel('fileTransfer');
      this.setupDataChannel();

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
    if (!this.dataChannel) {
      const error = new WebRTCError(
        'No connection established',
        WebRTCErrorCode.INVALID_STATE
      );
      console.error('[TRANSFER] Error:', error);
      this.onError(error);
      throw error;
    }

    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        console.log(`[TRANSFER] Processing chunk ${i + 1}/${totalChunks}`);
        const arrayBuffer = await chunk.arrayBuffer();
        const chunkArray = new Uint8Array(arrayBuffer);
        
        let encryptedChunk;
        try {
          encryptedChunk = await this.encryptionService.encryptChunk(chunkArray);
        } catch (error) {
          throw new WebRTCError(
            'Failed to encrypt chunk',
            WebRTCErrorCode.ENCRYPTION_FAILED,
            error
          );
        }
        
        const base64 = btoa(String.fromCharCode(...encryptedChunk));

        const message: FileChunkMessage = {
          type: 'file-chunk',
          filename: file.name,
          chunk: base64,
          chunkIndex: i,
          totalChunks,
          fileSize: file.size
        };

        if (this.dataChannel.bufferedAmount > this.dataChannel.bufferedAmountLowThreshold) {
          console.log('[TRANSFER] Waiting for buffer to clear...');
          await new Promise(resolve => {
            this.dataChannel!.onbufferedamountlow = () => {
              this.dataChannel!.onbufferedamountlow = null;
              resolve(null);
            };
          });
        }

        this.dataChannel.send(JSON.stringify(message));
        console.log(`[TRANSFER] Sent chunk ${i + 1}/${totalChunks}`);

        if (this.onProgress) {
          const progress: TransferProgress = {
            filename: file.name,
            bytesTransferred: Math.min((i + 1) * CHUNK_SIZE, file.size),
            totalBytes: file.size,
            percent: ((i + 1) / totalChunks) * 100,
            type: 'upload'
          };
          this.onProgress(progress);
        }
      }
      console.log(`[TRANSFER] Completed sending ${file.name}`);
    } catch (error) {
      const webRTCError = error instanceof WebRTCError ? error : new WebRTCError(
        'Failed to send file',
        WebRTCErrorCode.TRANSFER_FAILED,
        error
      );
      console.error('[TRANSFER] Error:', webRTCError);
      this.onError(webRTCError);
      throw webRTCError;
    }
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting peer connection');
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.connectionService.disconnect();
  }
}

export default WebRTCService;
