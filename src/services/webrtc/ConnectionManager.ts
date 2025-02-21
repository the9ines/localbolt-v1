
import { ConnectionError } from '@/types/webrtc-errors';

export class ConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private readonly connectionTimeout: number = 30000; // 30 seconds timeout

  constructor(
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    private onError: (error: Error) => void,
    private onDataChannel?: (channel: RTCDataChannel) => void
  ) {}

  async createPeerConnection(): Promise<RTCPeerConnection> {
    console.log('[WEBRTC] Creating peer connection');
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        }
      ],
      iceCandidatePoolSize: 10
    });

    this.setupConnectionListeners();
    return this.peerConnection;
  }

  private setupConnectionListeners() {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[ICE] New ICE candidate generated:', event.candidate.candidate);
        this.onIceCandidate(event.candidate);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[ICE] Connection state:', state);
      
      if (state === 'checking') {
        console.log('[ICE] Negotiating connection...');
      } else if (state === 'connected' || state === 'completed') {
        console.log('[ICE] Connection established');
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        console.error('[ICE] Connection failed:', state);
        this.onError(new ConnectionError("ICE connection failed", { state }));
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WEBRTC] Connection state:', state);
      
      if (state === 'connecting') {
        console.log('[WEBRTC] Establishing connection...');
      } else if (state === 'connected') {
        console.log('[WEBRTC] Connection established successfully');
      } else if (state === 'failed' || state === 'closed') {
        console.error('[WEBRTC] Connection failed:', state);
        this.onError(new ConnectionError("WebRTC connection failed", { state }));
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      console.log('[DATACHANNEL] Received data channel');
      if (this.onDataChannel) {
        this.onDataChannel(event.channel);
      }
    };
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) {
      console.log('[ICE] Queuing ICE candidate (no peer connection)');
      this.pendingIceCandidates.push(candidate);
      return;
    }

    const signalingState = this.peerConnection.signalingState;
    console.log('[ICE] Current signaling state:', signalingState);

    if (signalingState === 'stable' || signalingState === 'have-remote-offer' || signalingState === 'have-local-offer') {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[ICE] Added ICE candidate successfully');
      } catch (error) {
        console.error('[ICE] Failed to add ICE candidate:', error);
        this.pendingIceCandidates.push(candidate);
      }
    } else {
      console.log('[ICE] Queuing ICE candidate (invalid state)');
      this.pendingIceCandidates.push(candidate);
    }
  }

  async processPendingCandidates() {
    if (!this.peerConnection) return;

    console.log('[ICE] Processing pending candidates:', this.pendingIceCandidates.length);
    
    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('[ICE] Added pending ICE candidate');
        } catch (error) {
          console.error('[ICE] Failed to add pending ICE candidate:', error);
          // Re-queue the candidate if we're not ready
          if (this.peerConnection.signalingState !== 'closed') {
            this.pendingIceCandidates.unshift(candidate);
            break;
          }
        }
      }
    }
  }

  disconnect() {
    if (this.peerConnection) {
      console.log('[WEBRTC] Closing connection');
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.pendingIceCandidates = [];
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  getConnectionTimeout(): number {
    return this.connectionTimeout;
  }
}
