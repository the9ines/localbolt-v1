import { ConnectionError } from '@/types/webrtc-errors';

export class ConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private readonly connectionTimeout: number = 120000; // Increased to 120 seconds
  public onConnectionStateChange?: (state: RTCPeerConnectionState) => void;

  constructor(
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    private onError: (error: Error) => void,
    private onDataChannel?: (channel: RTCDataChannel) => void
  ) {}

  async createPeerConnection(): Promise<RTCPeerConnection> {
    console.log('[WEBRTC] Creating peer connection');
    
    const config: RTCConfiguration = {
      iceServers: [
        { 
          urls: [
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun3.l.google.com:19302',
            'stun:stun4.l.google.com:19302'
          ]
        },
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
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    this.peerConnection = new RTCPeerConnection(config);

    this.peerConnection.addEventListener('connectionstatechange', () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WEBRTC] Connection state changed:', state);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state as RTCPeerConnectionState);
      }
    });

    this.peerConnection.addEventListener('iceconnectionstatechange', () => {
      console.log('[ICE] Connection state:', this.peerConnection?.iceConnectionState);
      if (this.peerConnection?.iceConnectionState === 'failed') {
        console.log('[ICE] Connection failed, attempting to restart ICE');
        this.restartIce();
      }
    });
    
    this.peerConnection.addEventListener('icegatheringstatechange', () => {
      console.log('[ICE] Gathering state:', this.peerConnection?.iceGatheringState);
    });

    this.setupConnectionListeners();
    return this.peerConnection;
  }

  private async restartIce() {
    if (!this.peerConnection) return;
    
    try {
      if (this.peerConnection.restartIce) {
        console.log('[ICE] Restarting ICE connection');
        this.peerConnection.restartIce();
      } else {
        // Fallback for older browsers
        const offer = await this.peerConnection.createOffer({ iceRestart: true });
        await this.peerConnection.setLocalDescription(offer);
      }
    } catch (error) {
      console.error('[ICE] Failed to restart ICE:', error);
      this.onError(new ConnectionError('Failed to restart ICE connection'));
    }
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
