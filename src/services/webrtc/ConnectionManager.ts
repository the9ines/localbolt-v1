
import { ConnectionError } from '@/types/webrtc-errors';

export class ConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private readonly connectionTimeout: number = 60000; // Increased timeout for mobile connections

  constructor(
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    private onError: (error: Error) => void,
    private onDataChannel?: (channel: RTCDataChannel) => void
  ) {}

  async createPeerConnection(): Promise<RTCPeerConnection> {
    console.log('[WEBRTC] Creating peer connection');
    
    const config: RTCConfiguration = {
      iceServers: [
        // Primary STUN servers with multiple options
        { 
          urls: [
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun3.l.google.com:19302',
            'stun:stun4.l.google.com:19302'
          ]
        },
        // Multiple TURN servers for better reliability
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

    // Enhanced connection monitoring
    this.peerConnection.addEventListener('iceconnectionstatechange', () => {
      console.log('[ICE] Connection state changed:', this.peerConnection?.iceConnectionState);
      if (this.peerConnection?.iceConnectionState === 'failed') {
        this.onError(new ConnectionError('ICE connection failed'));
      }
    });
    
    this.peerConnection.addEventListener('icegatheringstatechange', () => {
      console.log('[ICE] Gathering state:', this.peerConnection?.iceGatheringState);
    });

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
        console.log('[ICE] New candidate:', event.candidate.candidate?.substring(0, 50) + '...');
        this.onIceCandidate(event.candidate);
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
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      console.log('[ICE] Queuing candidate - waiting for remote description');
      this.pendingIceCandidates.push(candidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[ICE] Added candidate successfully');
    } catch (error) {
      console.error('[ICE] Failed to add candidate:', error);
      if (this.peerConnection.signalingState !== 'closed') {
        this.pendingIceCandidates.push(candidate);
      }
    }
  }

  async processPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      console.log('[ICE] Cannot process candidates - no remote description');
      return;
    }

    console.log('[ICE] Processing pending candidates:', this.pendingIceCandidates.length);
    
    const candidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];

    for (const candidate of candidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[ICE] Added pending candidate successfully');
      } catch (error) {
        console.error('[ICE] Failed to add pending candidate:', error);
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
