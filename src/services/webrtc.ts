
import { supabase } from "@/integrations/supabase/client";
import { box, randomBytes } from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  from: string;
  to: string;
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localPeerCode: string;
  private remotePeerCode: string = '';
  private onReceiveFile: (file: Blob, filename: string) => void;
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private keyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  private remotePeerPublicKey: Uint8Array | null = null;

  constructor(localPeerCode: string, onReceiveFile: (file: Blob, filename: string) => void) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    this.localPeerCode = localPeerCode;
    this.onReceiveFile = onReceiveFile;
    this.keyPair = box.keyPair();
    this.setupSignalingListener();
  }

  private async setupSignalingListener() {
    console.log('[SIGNALING] Setting up signal listener');
    const channel = supabase.channel('signals')
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        console.log('[SIGNALING] Received signal:', payload.type);
        this.handleSignal(payload as SignalData);
      })
      .subscribe();
  }

  private async handleSignal(signal: SignalData) {
    if (signal.to !== this.localPeerCode) return;

    console.log(`[SIGNALING] Processing ${signal.type} from peer ${signal.from}`);

    if (signal.type === 'offer') {
      this.remotePeerCode = signal.from;
      this.remotePeerPublicKey = decodeBase64(signal.data.publicKey);
      await this.createPeerConnection();
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal.data.offer));
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      console.log('[SIGNALING] Created and sent answer');
      this.sendSignal('answer', {
        answer,
        publicKey: encodeBase64(this.keyPair.publicKey)
      });
    } else if (signal.type === 'answer') {
      console.log('[SIGNALING] Processing answer from remote peer');
      this.remotePeerPublicKey = decodeBase64(signal.data.publicKey);
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
    } else if (signal.type === 'ice-candidate' && this.peerConnection) {
      try {
        console.log('[ICE] Adding ICE candidate');
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.data));
      } catch (e) {
        console.error('[ICE] Error adding ice candidate:', e);
      }
    }
  }

  private async sendSignal(type: SignalData['type'], data: any) {
    console.log(`[SIGNALING] Sending ${type} to peer ${this.remotePeerCode}`);
    await supabase.channel('signals').send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type,
        data,
        from: this.localPeerCode,
        to: this.remotePeerCode,
      },
    });
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
        console.log('[ICE] New ICE candidate generated');
        this.sendSignal('ice-candidate', event.candidate);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[ICE] Connection state changed:', this.peerConnection?.iceConnectionState);
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WEBRTC] Connection state changed:', this.peerConnection?.connectionState);
    };

    this.peerConnection.ondatachannel = (event) => {
      console.log('[DATACHANNEL] Received data channel');
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    return this.peerConnection;
  }

  private async encryptChunk(chunk: Uint8Array): Promise<Uint8Array> {
    if (!this.remotePeerPublicKey) {
      console.error('[ENCRYPTION] No remote peer public key available');
      throw new Error('No remote peer public key');
    }
    const nonce = randomBytes(box.nonceLength);
    const encryptedChunk = box(
      chunk,
      nonce,
      this.remotePeerPublicKey,
      this.keyPair.secretKey
    );
    return new Uint8Array([...nonce, ...encryptedChunk]);
  }

  private async decryptChunk(encryptedData: Uint8Array): Promise<Uint8Array> {
    if (!this.remotePeerPublicKey) {
      console.error('[ENCRYPTION] No remote peer public key available');
      throw new Error('No remote peer public key');
    }
    const nonce = encryptedData.slice(0, box.nonceLength);
    const encryptedChunk = encryptedData.slice(box.nonceLength);
    const decryptedChunk = box.open(
      encryptedChunk,
      nonce,
      this.remotePeerPublicKey,
      this.keyPair.secretKey
    );
    if (!decryptedChunk) {
      console.error('[ENCRYPTION] Failed to decrypt chunk');
      throw new Error('Failed to decrypt chunk');
    }
    return decryptedChunk;
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    console.log('[DATACHANNEL] Setting up data channel');
    this.dataChannel.onmessage = async (event) => {
      try {
        const { type, filename, chunk, chunkIndex, totalChunks } = JSON.parse(event.data);

        if (type === 'file-chunk') {
          console.log(`[TRANSFER] Receiving chunk ${chunkIndex + 1}/${totalChunks} for ${filename}`);
          
          if (!this.chunksBuffer[filename]) {
            console.log(`[TRANSFER] Starting new transfer for ${filename}`);
            this.chunksBuffer[filename] = [];
          }

          const encryptedChunk = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
          const decryptedChunk = await this.decryptChunk(encryptedChunk);
          this.chunksBuffer[filename][chunkIndex] = new Blob([decryptedChunk]);

          if (this.chunksBuffer[filename].filter(Boolean).length === totalChunks) {
            console.log(`[TRANSFER] Completed transfer of ${filename}`);
            const file = new Blob(this.chunksBuffer[filename]);
            delete this.chunksBuffer[filename];
            this.onReceiveFile(file, filename);
          }
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
    await this.createPeerConnection();

    this.dataChannel = this.peerConnection!.createDataChannel('fileTransfer');
    this.setupDataChannel();

    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);
    console.log('[SIGNALING] Created and sent offer');
    this.sendSignal('offer', {
      offer,
      publicKey: encodeBase64(this.keyPair.publicKey)
    });
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
      
      const encryptedChunk = await this.encryptChunk(chunkArray);
      const base64 = btoa(String.fromCharCode(...encryptedChunk));

      const message = JSON.stringify({
        type: 'file-chunk',
        filename: file.name,
        chunk: base64,
        chunkIndex: i,
        totalChunks,
      });

      if (this.dataChannel.bufferedAmount > this.dataChannel.bufferedAmountLowThreshold) {
        console.log('[TRANSFER] Waiting for buffer to clear...');
        await new Promise(resolve => {
          this.dataChannel!.onbufferedamountlow = () => {
            this.dataChannel!.onbufferedamountlow = null;
            resolve(null);
          };
        });
      }

      this.dataChannel.send(message);
      console.log(`[TRANSFER] Sent chunk ${i + 1}/${totalChunks}`);
    }
    console.log(`[TRANSFER] Completed sending ${file.name}`);
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting peer connection');
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this.dataChannel = null;
    this.peerConnection = null;
    this.remotePeerPublicKey = null;
  }
}

export default WebRTCService;
