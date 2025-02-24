
import { ConnectionError } from '@/types/webrtc-errors';
import { getPlatformICEServers } from '@/lib/platform-utils';
import { ConnectionStateHandler } from './connection/ConnectionStateHandler';

export class ConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private readonly connectionTimeout: number = 30000; // 30 seconds timeout
  private connectionStateHandler: ConnectionStateHandler;
  private connectionStateChangeCallback?: (state: RTCPeerConnectionState) => void;

  constructor(
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    private onError: (error: Error) => void,
    private onDataChannel?: (channel: RTCDataChannel) => void
  ) {
    // First define the methods that will be bound
    this.handleReconnect = this.handleReconnect.bind(this);
    this.handleConnectionStateChange = this.handleConnectionStateChange.bind(this);

    // Then create the ConnectionStateHandler with the bound methods
    this.connectionStateHandler = new ConnectionStateHandler(
      this.handleReconnect,
      this.handleConnectionStateChange
    );
  }

  setConnectionStateChangeHandler(handler: (state: RTCPeerConnectionState) => void): void {
    this.connectionStateChangeCallback = handler;
  }

  private handleConnectionStateChange(state: RTCPeerConnectionState): void {
    if (this.connectionStateChangeCallback) {
      this.connectionStateChangeCallback(state);
    }
  }

  private async handleReconnect(): Promise<void> {
    console.log('[CONNECTION] Initiating reconnection');
    
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    const newConnection = await this.createPeerConnection();
    
    const cachedCandidates = this.connectionStateHandler.getCachedCandidates();
    for (const candidate of cachedCandidates) {
      try {
        await newConnection.addIceCandidate(candidate);
        console.log('[CONNECTION] Restored cached ICE candidate');
      } catch (error) {
        console.warn('[CONNECTION] Failed to restore cached candidate:', error);
      }
    }
  }

  async createPeerConnection(): Promise<RTCPeerConnection> {
    console.log('[WEBRTC] Creating peer connection');
    
    const iceServers = getPlatformICEServers();
    console.log('[WEBRTC] Using ICE servers:', iceServers);
    
    this.peerConnection = new RTCPeerConnection({
      iceServers,
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
        console.log('[ICE] New ICE candidate generated:', event.candidate.candidate);
        this.connectionStateHandler.cacheIceCandidate(event.candidate);
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

    this.peerConnection.onconnectionstatechange = async () => {
      const state = this.peerConnection?.connectionState;
      if (state) {
        await this.connectionStateHandler.handleConnectionStateChange(state);
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
          if (this.peerConnection.signalingState !== 'closed') {
            this.pendingIceCandidates.unshift(candidate);
            break;
          }
        }
      }
    }
  }

  disconnect() {
    this.connectionStateHandler.reset();
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
