
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';

export class ConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private connectionTimeout: number = 30000; // 30 seconds
  private peerConnectionStateHandler?: (state: RTCPeerConnectionState) => void;

  constructor(
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    private onError: (error: WebRTCError) => void,
    private onDataChannel: (channel: RTCDataChannel) => void
  ) {}

  setPeerConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.peerConnectionStateHandler = handler;
    if (this.peerConnection) {
      // Update existing connection to use new handler
      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection && this.peerConnectionStateHandler) {
          this.peerConnectionStateHandler(this.peerConnection.connectionState);
        }
      };
    }
  }

  async createPeerConnection(): Promise<RTCPeerConnection> {
    console.log('[WEBRTC] Creating peer connection');
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[ICE] New candidate:', event.candidate.candidate);
        this.onIceCandidate(event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[CONNECTION] State changed:', state);
      
      if (this.peerConnectionStateHandler && state) {
        this.peerConnectionStateHandler(state);
      }

      if (state === 'failed' || state === 'closed') {
        this.onError(new ConnectionError(
          "Connection failed",
          { state }
        ));
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      console.log('[DATACHANNEL] Received data channel');
      this.onDataChannel(event.channel);
    };

    return this.peerConnection;
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new ConnectionError("No peer connection established");
    }

    try {
      await this.peerConnection.addIceCandidate(candidate);
      console.log('[ICE] Successfully added candidate');
    } catch (error) {
      console.error('[ICE] Failed to add candidate:', error);
      throw new ConnectionError("Failed to add ICE candidate", error);
    }
  }

  getConnectionTimeout(): number {
    return this.connectionTimeout;
  }

  disconnect() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }
}
