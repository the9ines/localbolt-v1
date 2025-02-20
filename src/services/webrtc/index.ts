
import { box } from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { SignalData, FileChunkMessage } from './types';
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

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    const keyPair = box.keyPair();
    this.encryptionService = new EncryptionService(keyPair);
    this.connectionService = new ConnectionService();
    this.signalingService = new SignalingService(localPeerCode, this.handleSignal.bind(this));
  }

  private async handleSignal(signal: SignalData) {
    console.log(`[SIGNALING] Processing ${signal.type} from peer ${signal.from}`);
    const peerConnection = await this.ensurePeerConnection();

    if (signal.type === 'offer') {
      this.remotePeerCode = signal.from;
      this.encryptionService.setRemotePeerPublicKey(decodeBase64(signal.data.publicKey));
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('[SIGNALING] Created and sent answer');
      this.signalingService.sendSignal('answer', {
        answer,
        publicKey: encodeBase64(this.encryptionService.getPublicKey())
      }, signal.from);
    } else if (signal.type === 'answer') {
      this.encryptionService.setRemotePeerPublicKey(decodeBase64(signal.data.publicKey));
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
    } else if (signal.type === 'ice-candidate') {
      try {
        console.log('[ICE] Adding ICE candidate');
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal.data));
      } catch (e) {
        console.error('[ICE] Error adding ice candidate:', e);
      }
    }
  }

  private async ensurePeerConnection(): Promise<RTCPeerConnection> {
    const existing = this.connectionService.getPeerConnection();
    if (existing) return existing;

    const peerConnection = await this.connectionService.createPeerConnection();
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[ICE] New ICE candidate generated');
        this.signalingService.sendSignal('ice-candidate', event.candidate, this.remotePeerCode);
      }
    };

    peerConnection.ondatachannel = (event) => {
      console.log('[DATACHANNEL] Received data channel');
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    return peerConnection;
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

        const encryptedChunk = Uint8Array.from(atob(message.chunk), c => c.charCodeAt(0));
        const decryptedChunk = await this.encryptionService.decryptChunk(encryptedChunk);
        this.chunksBuffer[message.filename][message.chunkIndex] = new Blob([decryptedChunk]);

        if (this.chunksBuffer[message.filename].filter(Boolean).length === message.totalChunks) {
          console.log(`[TRANSFER] Completed transfer of ${message.filename}`);
          const file = new Blob(this.chunksBuffer[message.filename]);
          delete this.chunksBuffer[message.filename];
          this.onReceiveFile(file, message.filename);
        }
      } catch (error) {
        console.error('[TRANSFER] Error processing message:', error);
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('[DATACHANNEL] Error:', error);
    };

    this.dataChannel.onopen = () => {
      console.log('[DATACHANNEL] Channel opened');
    };

    this.dataChannel.onclose = () => {
      console.log('[DATACHANNEL] Channel closed');
    };
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    this.remotePeerCode = remotePeerCode;
    const peerConnection = await this.ensurePeerConnection();

    this.dataChannel = peerConnection.createDataChannel('fileTransfer');
    this.setupDataChannel();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('[SIGNALING] Created and sent offer');
    this.signalingService.sendSignal('offer', {
      offer,
      publicKey: encodeBase64(this.encryptionService.getPublicKey())
    }, remotePeerCode);
  }

  async sendFile(file: File) {
    if (!this.dataChannel) {
      console.error('[TRANSFER] No connection established');
      throw new Error('No connection established');
    }

    console.log(`[TRANSFER] Starting transfer of ${file.name} (${file.size} bytes)`);
    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      console.log(`[TRANSFER] Processing chunk ${i + 1}/${totalChunks}`);
      const arrayBuffer = await chunk.arrayBuffer();
      const chunkArray = new Uint8Array(arrayBuffer);
      
      const encryptedChunk = await this.encryptionService.encryptChunk(chunkArray);
      const base64 = btoa(String.fromCharCode(...encryptedChunk));

      const message: FileChunkMessage = {
        type: 'file-chunk',
        filename: file.name,
        chunk: base64,
        chunkIndex: i,
        totalChunks,
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
    }
    console.log(`[TRANSFER] Completed sending ${file.name}`);
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
