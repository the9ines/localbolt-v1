
import { supabase } from "@/integrations/supabase/client";

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

  constructor(localPeerCode: string, onReceiveFile: (file: Blob, filename: string) => void) {
    this.localPeerCode = localPeerCode;
    this.onReceiveFile = onReceiveFile;
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
      await this.createPeerConnection();
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal.data));
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      this.sendSignal('answer', answer);
    } else if (signal.type === 'answer') {
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal.data));
    } else if (signal.type === 'ice-candidate' && this.peerConnection) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.data));
      } catch (e) {
        console.error('Error adding ice candidate:', e);
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
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

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

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onmessage = async (event) => {
      const { type, filename, chunk, chunkIndex, totalChunks } = JSON.parse(event.data);

      if (type === 'file-chunk') {
        if (!this.chunksBuffer[filename]) {
          this.chunksBuffer[filename] = [];
        }

        // Convert base64 chunk back to Blob
        const binaryString = atob(chunk);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        this.chunksBuffer[filename][chunkIndex] = new Blob([bytes]);

        // Check if we have all chunks
        if (this.chunksBuffer[filename].length === totalChunks) {
          const file = new Blob(this.chunksBuffer[filename]);
          delete this.chunksBuffer[filename];
          this.onReceiveFile(file, filename);
        }
      }
    };
  }

  async connect(remotePeerCode: string): Promise<void> {
    this.remotePeerCode = remotePeerCode;
    await this.createPeerConnection();

    this.dataChannel = this.peerConnection!.createDataChannel('fileTransfer');
    this.setupDataChannel();

    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);
    this.sendSignal('offer', offer);
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
      
      // Convert chunk to base64
      const buffer = await chunk.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const message = JSON.stringify({
        type: 'file-chunk',
        filename: file.name,
        chunk: base64,
        chunkIndex: i,
        totalChunks,
      });

      // Wait for the channel to be ready to send more data
      if (this.dataChannel.bufferedAmount > this.dataChannel.bufferedAmountLowThreshold) {
        await new Promise(resolve => {
          this.dataChannel!.onbufferedamountlow = () => {
            this.dataChannel!.onbufferedamountlow = null;
            resolve(null);
          };
        });
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
  }
}

export default WebRTCService;
