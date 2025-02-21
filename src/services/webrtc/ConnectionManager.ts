import { ConnectionError } from '@/types/webrtc-errors';

export class ConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private readonly connectionTimeout: number = 45000; // Increased timeout for mobile networks

  constructor(
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    private onError: (error: Error) => void,
    private onDataChannel?: (channel: RTCDataChannel) => void
  ) {}

  async createPeerConnection(): Promise<RTCPeerConnection> {
    console.log('[WEBRTC] Creating peer connection');
    
    const config: RTCConfiguration = {
      iceServers: [
        // Primary STUN servers
        { 
          urls: [
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun3.l.google.com:19302',
            'stun:stun4.l.google.com:19302'
          ]
        },
        // Fallback TURN servers with multiple protocols
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
            'turns:openrelay.metered.ca:443'
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    this.peerConnection = new RTCPeerConnection(config);
    
    // Add additional connection monitoring
    this.peerConnection.addEventListener('connectionstatechange', () => {
      console.log('[WEBRTC] Connection state changed:', this.peerConnection?.connectionState);
    });

    this.peerConnection.addEventListener('negotiationneeded', () => {
      console.log('[WEBRTC] Negotiation needed');
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
        this.onError(new ConnectionError(`ICE connection failed: ${state}`, { state }));
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
        this.onError(new ConnectionError(`WebRTC connection failed: ${state}`, { state }));
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      console.log('[DATACHANNEL] Received data channel');
      if (this.onDataChannel) {
        this.onDataChannel(event.channel);
      }
    };

    // Monitor gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[ICE] Gathering state:', this.peerConnection?.iceGatheringState);
    };
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) {
      console.log('[ICE] Queuing ICE candidate (no peer connection)');
      this.pendingIceCandidates.push(candidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[ICE] Added ICE candidate successfully');
    } catch (error) {
      console.error('[ICE] Failed to add ICE candidate:', error);
      // Only queue if we're still in a valid state
      if (this.peerConnection.signalingState !== 'closed') {
        console.log('[ICE] Queuing failed candidate for retry');
        this.pendingIceCandidates.push(candidate);
      }
    }
  }

  async processPendingCandidates() {
    if (!this.peerConnection) return;

    console.log('[ICE] Processing pending candidates:', this.pendingIceCandidates.length);
    
    const candidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];

    for (const candidate of candidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[ICE] Added pending ICE candidate');
      } catch (error) {
        console.error('[ICE] Failed to add pending ICE candidate:', error);
        if (this.peerConnection.signalingState !== 'closed') {
          this.pendingIceCandidates.push(candidate);
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
