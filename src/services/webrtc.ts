
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
  private pendingCandidates: RTCIceCandidate[] = [];
  private isSettingRemoteDescription: boolean = false;

  constructor(localPeerCode: string, onReceiveFile: (file: Blob, filename: string) => void) {
    this.localPeerCode = localPeerCode;
    this.onReceiveFile = onReceiveFile;
    this.keyPair = box.keyPair();
    this.setupSignalingListener();
  }

  private async setupSignalingListener() {
    const channel = supabase.channel('signals')
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        this.handleSignal(payload as SignalData);
      })
      .subscribe();
  }

  private async handleSignal(signal: SignalData) {
    if (signal.to !== this.localPeerCode) return;

    if (signal.type === 'offer') {
      this.remotePeerCode = signal.from;
      this.remotePeerPublicKey = decodeBase64(signal.data.publicKey);
      await this.createPeerConnection();
      this.isSettingRemoteDescription = true;
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal.data.offer));
      this.isSettingRemoteDescription = false;
      
      // Add any pending candidates
      for (const candidate of this.pendingCandidates) {
        try {
          await this.peerConnection!.addIceCandidate(candidate);
        } catch (e) {
          console.error('Error adding pending ice candidate:', e);
        }
      }
      this.pendingCandidates = [];

      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      this.sendSignal('answer', {
        answer,
        publicKey: encodeBase64(this.keyPair.publicKey)
      });
    } else if (signal.type === 'answer') {
      this.remotePeerPublicKey = decodeBase64(signal.data.publicKey);
      this.isSettingRemoteDescription = true;
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
      this.isSettingRemoteDescription = false;
      
      // Add any pending candidates
      for (const candidate of this.pendingCandidates) {
        try {
          await this.peerConnection!.addIceCandidate(candidate);
        } catch (e) {
          console.error('Error adding pending ice candidate:', e);
        }
      }
      this.pendingCandidates = [];
    } else if (signal.type === 'ice-candidate' && this.peerConnection) {
      const candidate = new RTCIceCandidate(signal.data);
      
      if (this.isSettingRemoteDescription) {
        // If we're in the process of setting remote description, queue the candidate
        this.pendingCandidates.push(candidate);
      } else {
        try {
          await this.peerConnection.addIceCandidate(candidate);
        } catch (e) {
          console.error('Error adding ice candidate:', e);
          // Queue the candidate if it failed
          this.pendingCandidates.push(candidate);
        }
      }
    }
  }

  private async sendSignal(type: SignalData['type'], data: any) {
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
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10
    };

    this.peerConnection = new RTCPeerConnection(config);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('ice-candidate', event.candidate);
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    return this.peerConnection;
  }

  private async encryptChunk(chunk: Uint8Array): Promise<Uint8Array> {
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

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.bufferedAmountLowThreshold = 65535;
    this.dataChannel.onmessage = async (event) => {
      try {
        const { type, filename, chunk, chunkIndex, totalChunks } = JSON.parse(event.data);

        if (type === 'file-chunk') {
          if (!this.chunksBuffer[filename]) {
            this.chunksBuffer[filename] = [];
          }

          const encryptedChunk = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
          const decryptedChunk = await this.decryptChunk(encryptedChunk);
          this.chunksBuffer[filename][chunkIndex] = new Blob([decryptedChunk]);

          if (this.chunksBuffer[filename].filter(Boolean).length === totalChunks) {
            const file = new Blob(this.chunksBuffer[filename]);
            delete this.chunksBuffer[filename];
            this.onReceiveFile(file, filename);
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };
  }

  async connect(remotePeerCode: string): Promise<void> {
    this.remotePeerCode = remotePeerCode;
    await this.createPeerConnection();

    this.dataChannel = this.peerConnection!.createDataChannel('fileTransfer', {
      ordered: true
    });
    this.setupDataChannel();

    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);
    this.sendSignal('offer', {
      offer,
      publicKey: encodeBase64(this.keyPair.publicKey)
    });
  }

  async sendFile(file: File) {
    if (!this.dataChannel) {
      throw new Error('No connection established');
    }

    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
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

      while (this.dataChannel.bufferedAmount > this.dataChannel.bufferedAmountLowThreshold) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.dataChannel.send(message);
    }
  }

  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this.dataChannel = null;
    this.peerConnection = null;
    this.remotePeerPublicKey = null;
    this.pendingCandidates = [];
  }
}

export default WebRTCService;
