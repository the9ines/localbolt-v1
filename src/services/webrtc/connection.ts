
export class ConnectionService {
  private peerConnection: RTCPeerConnection | null = null;

  async createPeerConnection(): Promise<RTCPeerConnection> {
    console.log('[WEBRTC] Creating peer connection');
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.setupConnectionListeners();
    return this.peerConnection;
  }

  private setupConnectionListeners() {
    if (!this.peerConnection) return;

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[ICE] Connection state changed:', this.peerConnection?.iceConnectionState);
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WEBRTC] Connection state changed:', this.peerConnection?.connectionState);
    };
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  disconnect() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}
