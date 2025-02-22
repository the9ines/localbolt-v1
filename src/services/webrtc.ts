import { box, randomBytes } from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { supabase } from "@/integrations/supabase/client";
import { 
  WebRTCError, 
  ConnectionError, 
  SignalingError, 
  TransferError, 
  EncryptionError 
} from '@/types/webrtc-errors';

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
  private onError: (error: WebRTCError) => void;
  private chunksBuffer: { [key: string]: Blob[] } = {};
  private keyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  private remotePeerPublicKey: Uint8Array | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private connectionTimeout: number = 30000; // 30 seconds timeout
  private isInitialized: boolean = false;

  constructor(
    localPeerCode: string, 
    onReceiveFile: (file: Blob, filename: string) => void,
    onError: (error: WebRTCError) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    this.localPeerCode = localPeerCode;
    this.onReceiveFile = onReceiveFile;
    this.onError = onError;
    this.keyPair = box.keyPair();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.setupSignalingListener();
      this.isInitialized = true;
    } catch (error) {
      this.onError(new SignalingError("Failed to initialize WebRTC service", error));
      throw error;
    }
  }

  private async setupSignalingListener() {
    console.log('[SIGNALING] Setting up signaling channel');
    try {
      const channel = supabase.channel('signals')
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          console.log('[SIGNALING] Received signal:', payload.type);
          this.handleSignal(payload as SignalData);
        })
        .subscribe();
    } catch (error) {
      throw new SignalingError("Failed to setup signaling channel", error);
    }
  }

  private async handleSignal(signal: SignalData) {
    if (signal.to !== this.localPeerCode) return;
    console.log('[SIGNALING] Processing signal:', signal.type, 'from:', signal.from);

    try {
      if (signal.type === 'offer') {
        await this.handleOffer(signal);
      } else if (signal.type === 'answer') {
        await this.handleAnswer(signal);
      } else if (signal.type === 'ice-candidate') {
        await this.handleIceCandidate(signal);
      }
    } catch (error) {
      const signalingError = new SignalingError(
        `Failed to handle ${signal.type} signal`,
        error
      );
      console.error('[SIGNALING] Handler error:', signalingError);
      this.onError(signalingError);
    }
  }

  private async handleOffer(signal: SignalData) {
    console.log('[SIGNALING] Received offer from peer:', signal.from);
    this.remotePeerCode = signal.from;
    this.remotePeerPublicKey = decodeBase64(signal.data.publicKey);
    await this.createPeerConnection();
    
    const offerDesc = new RTCSessionDescription(signal.data.offer);
    await this.peerConnection!.setRemoteDescription(offerDesc);
    console.log('[SIGNALING] Set remote description (offer)');
    
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    console.log('[SIGNALING] Created and sending answer');
    
    await this.sendSignal('answer', {
      answer,
      publicKey: encodeBase64(this.keyPair.publicKey)
    });

    // Process any pending ICE candidates
    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      await this.peerConnection!.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[ICE] Added pending ICE candidate');
    }
  }

  private async handleAnswer(signal: SignalData) {
    console.log('[SIGNALING] Received answer from peer:', signal.from);
    this.remotePeerPublicKey = decodeBase64(signal.data.publicKey);
    
    if (!this.peerConnection) {
      throw new ConnectionError("No peer connection established");
    }

    if (this.peerConnection.signalingState === 'have-local-offer') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
      console.log('[SIGNALING] Set remote description (answer)');
      
      while (this.pendingIceCandidates.length > 0) {
        const candidate = this.pendingIceCandidates.shift();
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[ICE] Added pending ICE candidate');
      }
    } else {
      throw new SignalingError(
        "Received answer in invalid state",
        { state: this.peerConnection.signalingState }
      );
    }
  }

  private async handleIceCandidate(signal: SignalData) {
    if (!this.peerConnection) {
      console.log('[ICE] Queuing ICE candidate (no peer connection)');
      this.pendingIceCandidates.push(signal.data);
      return;
    }

    const signalingState = this.peerConnection.signalingState;
    if (signalingState === 'stable' || signalingState === 'have-remote-offer' || signalingState === 'have-local-offer') {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.data));
      console.log('[ICE] Added ICE candidate');
    } else {
      console.log('[ICE] Queuing ICE candidate (invalid state)');
      this.pendingIceCandidates.push(signal.data);
    }
  }

  private async sendSignal(type: SignalData['type'], data: any) {
    console.log('[SIGNALING] Sending signal:', type, 'to:', this.remotePeerCode);
    try {
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
    } catch (error) {
      throw new SignalingError(
        `Failed to send ${type} signal`,
        error
      );
    }
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
        console.log('[ICE] New ICE candidate generated:', event.candidate.candidate);
        this.sendSignal('ice-candidate', event.candidate).catch(error => {
          console.error('[ICE] Failed to send candidate:', error);
          this.onError(new SignalingError("Failed to send ICE candidate", error));
        });
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[ICE] Connection state:', state);
      
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.onError(new ConnectionError(
          "ICE connection failed",
          { state }
        ));
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WEBRTC] Connection state:', state);
      
      if (state === 'failed' || state === 'closed') {
        this.onError(new ConnectionError(
          "WebRTC connection failed",
          { state }
        ));
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
    
    this.dataChannel.onopen = () => {
      console.log('[DATACHANNEL] Channel opened');
    };

    this.dataChannel.onclose = () => {
      console.log('[DATACHANNEL] Channel closed');
    };

    this.dataChannel.onerror = (error) => {
      console.error('[DATACHANNEL] Error:', error);
      this.onError(new TransferError(
        "Data channel error",
        error
      ));
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

          try {
            const encryptedChunk = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
            const decryptedChunk = await this.decryptChunk(encryptedChunk);
            this.chunksBuffer[filename][chunkIndex] = new Blob([decryptedChunk]);

            if (this.chunksBuffer[filename].filter(Boolean).length === totalChunks) {
              console.log(`[TRANSFER] Completed transfer of ${filename}`);
              const file = new Blob(this.chunksBuffer[filename]);
              delete this.chunksBuffer[filename];
              this.onReceiveFile(file, filename);
            }
          } catch (error) {
            delete this.chunksBuffer[filename];
            throw new EncryptionError(
              "Failed to decrypt file chunk",
              { filename, chunkIndex, error }
            );
          }
        }
      } catch (error) {
        if (error instanceof WebRTCError) {
          this.onError(error);
        } else {
          console.error('[TRANSFER] Error processing message:', error);
          this.onError(new TransferError(
            "Failed to process received data",
            error
          ));
        }
      }
    };
  }

  private async encryptChunk(chunk: Uint8Array): Promise<Uint8Array> {
    console.log('[ENCRYPTION] Encrypting chunk');
    if (!this.remotePeerPublicKey) {
      throw new EncryptionError("No remote peer public key available");
    }
    
    try {
      const nonce = randomBytes(box.nonceLength);
      const encryptedChunk = box(
        chunk,
        nonce,
        this.remotePeerPublicKey,
        this.keyPair.secretKey
      );
      return new Uint8Array([...nonce, ...encryptedChunk]);
    } catch (error) {
      throw new EncryptionError(
        "Failed to encrypt chunk",
        error
      );
    }
  }

  private async decryptChunk(encryptedData: Uint8Array): Promise<Uint8Array> {
    console.log('[ENCRYPTION] Decrypting chunk');
    if (!this.remotePeerPublicKey) {
      throw new EncryptionError("No remote peer public key available");
    }
    
    try {
      const nonce = encryptedData.slice(0, box.nonceLength);
      const encryptedChunk = encryptedData.slice(box.nonceLength);
      const decryptedChunk = box.open(
        encryptedChunk,
        nonce,
        this.remotePeerPublicKey,
        this.keyPair.secretKey
      );
      
      if (!decryptedChunk) {
        throw new EncryptionError("Decryption failed");
      }
      
      return decryptedChunk;
    } catch (error) {
      throw new EncryptionError(
        "Failed to decrypt chunk",
        error
      );
    }
  }

  async connect(remotePeerCode: string): Promise<void> {
    console.log('[WEBRTC] Initiating connection to peer:', remotePeerCode);
    
    const connectionPromise = new Promise<void>(async (resolve, reject) => {
      try {
        this.remotePeerCode = remotePeerCode;
        await this.createPeerConnection();

        this.dataChannel = this.peerConnection!.createDataChannel('fileTransfer');
        this.setupDataChannel();

        const offer = await this.peerConnection!.createOffer();
        await this.peerConnection!.setLocalDescription(offer);
        console.log('[SIGNALING] Created and set local description (offer)');
        
        await this.sendSignal('offer', {
          offer,
          publicKey: encodeBase64(this.keyPair.publicKey)
        });

        // Wait for connection to be established
        const checkConnection = () => {
          if (this.peerConnection?.connectionState === 'connected') {
            resolve();
          } else if (this.peerConnection?.connectionState === 'failed') {
            reject(new ConnectionError("Connection failed"));
          }
        };

        this.peerConnection!.onconnectionstatechange = checkConnection;
        checkConnection(); // Check initial state
      } catch (error) {
        reject(new ConnectionError("Failed to initiate connection", error));
      }
    });

    // Add timeout
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new ConnectionError("Connection timeout"));
      }, this.connectionTimeout);
    });

    try {
      await Promise.race([connectionPromise, timeoutPromise]);
    } catch (error) {
      this.disconnect(); // Clean up on failure
      throw error instanceof WebRTCError ? error : new ConnectionError("Connection failed", error);
    }
  }

  async sendFile(file: File) {
    if (!this.dataChannel) {
      throw new TransferError("No connection established");
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
        
        try {
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
        } catch (error) {
          throw new TransferError(
            "Failed to send file chunk",
            { chunkIndex: i, totalChunks, error }
          );
        }
      }
      console.log(`[TRANSFER] Completed sending ${file.name}`);
    } catch (error) {
      console.error('[TRANSFER] Error sending file:', error);
      if (error instanceof WebRTCError) {
        throw error;
      } else {
        throw new TransferError("Failed to send file", error);
      }
    }
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
  }
}

export default WebRTCService;
