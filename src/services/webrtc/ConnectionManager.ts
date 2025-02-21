
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
    
    if (this.peerConnection) {
      console.log('[WEBRTC] Closing existing connection before creating new one');
      this.peerConnection.close();
    }
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { 
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun3.l.google.com:19302',
            'stun:stun4.l.google.com:19302'
          ]
        },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all'
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
      } else {
        console.log('[ICE] All candidates gathered');
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[ICE] Connection state changed to:', state);
      
      if (state === 'checking') {
        console.log('[ICE] Negotiating connection...');
      } else if (state === 'connected' || state === 'completed') {
        console.log('[ICE] Connection established');
        this.processPendingCandidates();
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        console.error('[ICE] Connection failed:', state);
        this.onError(new ConnectionError("ICE connection failed", { state }));
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WEBRTC] Connection state changed to:', state);
      
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

    // Add gathering state change listener
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[ICE] Gathering state:', this.peerConnection?.iceGatheringState);
    };

    // Add signaling state change listener
    this.peerConnection.onsignalingstatechange = () => {
      console.log('[WEBRTC] Signaling state:', this.peerConnection?.signalingState);
    };
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) {
      console.log('[ICE] Queuing ICE candidate (no peer connection)');
      this.pendingIceCandidates.push(candidate);
      return;
    }

    if (!this.peerConnection.remoteDescription) {
      console.log('[ICE] Queuing ICE candidate (no remote description)');
      this.pendingIceCandidates.push(candidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[ICE] Added ICE candidate successfully');
    } catch (error) {
      console.error('[ICE] Failed to add ICE candidate:', error);
      this.pendingIceCandidates.push(candidate);
    }
  }

  async processPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      return;
    }

    console.log('[ICE] Processing pending candidates:', this.pendingIceCandidates.length);
    
    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('[ICE] Added pending ICE candidate successfully');
        } catch (error) {
          console.error('[ICE] Failed to add pending ICE candidate:', error);
          if (this.peerConnection.remoteDescription) {
            this.pendingIceCandidates.unshift(candidate);
          }
          break;
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
