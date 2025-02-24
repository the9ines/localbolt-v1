
import { ConnectionError } from '@/types/webrtc-errors';
import { getPlatformICEServers } from '@/lib/platform-utils';
import { ConnectionStateHandler } from './connection/ConnectionStateHandler';

export class ConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private connectionStateHandler: ConnectionStateHandler;
  private connectionStateChangeCallback?: (state: RTCPeerConnectionState) => void;

  constructor(
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    private onError: (error: Error) => void,
    private onDataChannel?: (channel: RTCDataChannel) => void
  ) {
    const handleReconnect = async (): Promise<void> => {
      console.log('[CONNECTION] Initiating reconnection');
      if (this.peerConnection) {
        this.peerConnection.close();
      }
      await this.createPeerConnection();
    };

    const handleConnectionStateChange = (state: RTCPeerConnectionState): void => {
      console.log('[CONNECTION] State changed to:', state);
      if (this.connectionStateChangeCallback) {
        this.connectionStateChangeCallback(state);
      }
    };

    this.connectionStateHandler = new ConnectionStateHandler(
      handleReconnect,
      handleConnectionStateChange
    );
  }

  setConnectionStateChangeHandler(handler: (state: RTCPeerConnectionState) => void): void {
    this.connectionStateChangeCallback = handler;
  }

  async createPeerConnection(): Promise<RTCPeerConnection> {
    console.log('[WEBRTC] Creating peer connection');
    
    const iceServers = getPlatformICEServers();
    console.log('[WEBRTC] Using ICE servers:', iceServers);
    
    this.peerConnection = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10
    });

    this.setupConnectionListeners();
    return this.peerConnection;
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }

  private setupConnectionListeners() {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[ICE] New ICE candidate generated');
        this.onIceCandidate(event.candidate);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[ICE] Connection state:', state);
      
      if (state === 'connected' || state === 'completed') {
        console.log('[ICE] Connection established');
        this.processPendingCandidates().catch(console.error);
      } else if (state === 'failed') {
        console.error('[ICE] Connection failed');
        this.onError(new ConnectionError("ICE connection failed"));
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state) {
        this.connectionStateHandler.handleConnectionStateChange(state);
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
      this.pendingIceCandidates.push(candidate);
      return;
    }

    try {
      if (this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[ICE] Added ICE candidate');
      } else {
        this.pendingIceCandidates.push(candidate);
      }
    } catch (error) {
      console.error('[ICE] Failed to add ICE candidate:', error);
      this.pendingIceCandidates.push(candidate);
    }
  }

  private async processPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

    const candidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];

    for (const candidate of candidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('[ICE] Failed to add pending ICE candidate:', error);
        if (this.peerConnection.connectionState !== 'closed') {
          this.pendingIceCandidates.push(candidate);
        }
      }
    }
  }

  disconnect() {
    this.connectionStateHandler.reset();
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.pendingIceCandidates = [];
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }
}
