
import { ConnectionError } from '@/types/webrtc-errors';

export class ConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private readonly connectionTimeout: number = 30000; // 30 seconds timeout
  private connectionStateChangeCallback?: (state: RTCPeerConnectionState) => void;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 3;
  private reconnectTimeout: number | null = null;

  constructor(
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    private onError: (error: Error) => void,
    private onDataChannel?: (channel: RTCDataChannel) => void
  ) {}

  setConnectionStateChangeHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateChangeCallback = handler;
  }

  async createPeerConnection(): Promise<RTCPeerConnection> {
    console.log('[CONNECTION] Creating peer connection');
    
    if (this.peerConnection) {
      console.log('[CONNECTION] Cleaning up existing connection');
      this.peerConnection.close();
    }
    
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
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });

    this.setupConnectionListeners();
    return this.peerConnection;
  }

  private setupConnectionListeners() {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[ICE] New ICE candidate:', event.candidate.candidate);
        this.onIceCandidate(event.candidate);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[ICE] Connection state changed:', state);
      
      if (state === 'checking') {
        console.log('[ICE] Negotiating connection...');
      } else if (state === 'connected' || state === 'completed') {
        console.log('[ICE] Connection established');
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      } else if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionFailure(state);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[CONNECTION] State changed:', state);
      
      if (state) {
        if (this.connectionStateChangeCallback) {
          this.connectionStateChangeCallback(state);
        }
      }
      
      if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionFailure(state);
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      console.log('[DATACHANNEL] Received data channel');
      if (this.onDataChannel) {
        this.onDataChannel(event.channel);
      }
    };
  }

  private handleConnectionFailure(state: string) {
    console.log('[CONNECTION] Handling connection failure:', state);
    
    // Clear any existing reconnection timeout
    if (this.reconnectTimeout !== null) {
      window.clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // Exponential backoff
      
      console.log(`[CONNECTION] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      this.reconnectTimeout = window.setTimeout(async () => {
        try {
          await this.createPeerConnection();
          console.log('[CONNECTION] Reconnection attempt initiated');
        } catch (error) {
          console.error('[CONNECTION] Reconnection attempt failed:', error);
          this.onError(new ConnectionError("Reconnection failed", { state, attempts: this.reconnectAttempts }));
        }
      }, delay);
    } else {
      console.error('[CONNECTION] Max reconnection attempts reached');
      this.onError(new ConnectionError(`Connection ${state}`, { state }));
    }
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
          if (this.peerConnection.signalingState !== 'closed') {
            this.pendingIceCandidates.unshift(candidate);
            break;
          }
        }
      }
    }
  }

  disconnect() {
    if (this.reconnectTimeout !== null) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.peerConnection) {
      console.log('[CONNECTION] Closing connection');
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.pendingIceCandidates = [];
    this.reconnectAttempts = 0;
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  getConnectionTimeout(): number {
    return this.connectionTimeout;
  }
}
