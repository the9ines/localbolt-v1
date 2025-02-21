
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
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private transferInProgress: boolean = false;

  constructor(localPeerCode: string, onReceiveFile: (file: Blob, filename: string) => void) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    this.localPeerCode = localPeerCode;
    this.onReceiveFile = onReceiveFile;
    this.keyPair = box.keyPair();
    this.setupSignalingListener();
  }

  private async setupSignalingListener() {
    console.log('[SIGNALING] Setting up signaling channel');
    const channel = supabase.channel('signals')
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        console.log('[SIGNALING] Received signal:', payload.type);
        this.handleSignal(payload as SignalData);
      })
      .subscribe();
  }

  private async handleSignal(signal: SignalData) {
    if (signal.to !== this.localPeerCode) return;
    console.log('[SIGNALING] Processing signal:', signal.type, 'from:', signal.from);

    try {
      if (signal.type === 'offer') {
        console.log('[SIGNALING] Received offer from peer:', signal.from);
        this.remotePeerCode = signal.from;
        this.remotePeerPublicKey = decodeBase64(signal.data.publicKey);
        await this.createPeerConnection();
        await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal.data.offer));
        const answer = await this.peerConnection!.createAnswer();
        await this.peerConnection!.setLocalDescription(answer);
        console.log('[SIGNALING] Created and sending answer');
        await this.sendSignal('answer', {
          answer,
          publicKey: encodeBase64(this.keyPair.publicKey)
        });
      } else if (signal.type === 'answer' && this.peerConnection?.signalingState === 'have-local-offer') {
        console.log('[SIGNALING] Received answer from peer:', signal.from);
        this.remotePeerPublicKey = decodeBase64(signal.data.publicKey);
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
      } else if (signal.type === 'ice-candidate' && this.peerConnection) {
        try {
          console.log('[ICE] Adding received ICE candidate');
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.data));
        } catch (e) {
          console.error('[ICE] Error adding ice candidate:', e);
          if (this.peerConnection.connectionState === 'failed' && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnection();
          }
        }
      }
    } catch (error) {
      console.error('[SIGNALING] Error handling signal:', error);
      if (this.peerConnection?.connectionState === 'failed' && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnection();
      }
    }
  }

  private async attemptReconnection() {
    console.log('[RECONNECT] Attempting reconnection, attempt:', this.reconnectAttempts + 1);
    this.reconnectAttempts++;
    this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.connect(this.remotePeerCode);
  }

  private async sendSignal(type: SignalData['type'], data: any) {
    console.log('[SIGNALING] Sending signal:', type, 'to:', this.remotePeerCode);
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
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[ICE] New ICE candidate generated:', event.candidate.candidate);
        this.sendSignal('ice-candidate', event.candidate);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[ICE] Connection state:', this.peerConnection?.iceConnectionState);
      if (this.peerConnection?.iceConnectionState === 'failed' && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnection();
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WEBRTC] Connection state:', this.peerConnection?.connectionState);
      if (this.peerConnection?.connectionState === 'failed' && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnection();
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      console.log('[DATACHANNEL] Received data channel');
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    return this.peerConnection;
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    console.log('[DATACHANNEL] Setting up data channel');
    
    this.dataChannel.bufferedAmountLowThreshold = 262144; // 256 KB threshold
    
    this.dataChannel.onopen = () => {
      console.log('[DATACHANNEL] Channel opened');
      this.transferInProgress = false;
    };

    this.dataChannel.onclose = () => {
      console.log('[DATACHANNEL] Channel closed');
      if (this.transferInProgress && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnection();
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('[DATACHANNEL] Error:', error);
      if (this.transferInProgress && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnection();
      }
    };

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
            this.transferInProgress = false;
          }
        }
      } catch (error) {
        console.error('[TRANSFER] Error processing message:', error);
        if (this.transferInProgress && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnection();
        }
      }
    };
  }

  private async encryptChunk(chunk: Uint8Array): Promise<Uint8Array> {
    console.log('[ENCRYPTION] Encrypting chunk');
    if (!this.remotePeerPublicKey) throw new Error('No remote peer public key');
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
    console.log('[ENCRYPTION] Decrypting chunk');
    if (!this.remotePeerPublicKey) throw new Error('No remote peer public key');
    const nonce = encryptedData.slice(0, box.nonceLength);
    const encryptedChunk = encryptedData.slice(box.nonceLength);
    const decryptedChunk = box.open(
      encryptedChunk,
      nonce,
      this.remotePeerPublicKey,
      this.keyPair.secretKey
    );
    if (!decryptedChunk) throw new Error('Failed to decrypt chunk');
    return decryptedChunk;
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    this.remotePeerCode = remotePeerCode;
    await this.createPeerConnection();

    this.dataChannel = this.peerConnection!.createDataChannel('fileTransfer', {
      ordered: true,
    });
    this.setupDataChannel();

    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);
    console.log('[SIGNALING] Created and sent offer');
    await this.sendSignal('offer', {
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
    this.transferInProgress = true;
    this.reconnectAttempts = 0;

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
        console.log('[TRANSFER] Waiting for buffer to clear');
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
    this.transferInProgress = false;
  }

  disconnect() {
    console.log('[WEBRTC] Disconnecting');
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this.dataChannel = null;
    this.peerConnection = null;
    this.remotePeerPublicKey = null;
    this.transferInProgress = false;
    this.reconnectAttempts = 0;
  }
}

export default WebRTCService;
