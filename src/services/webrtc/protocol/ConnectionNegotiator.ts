
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import type { DiscoveredPeer, NetworkType, TransportMode } from '../types/discovery-types';
import { NetworkDiscovery } from '../discovery/NetworkDiscovery';
import { ConnectionManager } from '../ConnectionManager';
import { SignalingService } from '../SignalingService';

export class ConnectionNegotiator {
  private currentTransportMode: TransportMode | null = null;
  private connectionRetries: number = 0;
  private readonly MAX_RETRIES = 3;

  constructor(
    private networkDiscovery: NetworkDiscovery,
    private connectionManager: ConnectionManager,
    private signalingService: SignalingService,
    private onConnectionStateChange: (state: RTCPeerConnectionState) => void
  ) {}

  async negotiateConnection(remotePeerCode: string): Promise<void> {
    console.log('[NEGOTIATOR] Starting connection negotiation with peer:', remotePeerCode);
    
    try {
      // First attempt: Try local network connection
      const transportMode = await this.selectBestTransport();
      await this.establishConnection(remotePeerCode, transportMode);
    } catch (error) {
      console.error('[NEGOTIATOR] Initial connection attempt failed:', error);
      await this.handleConnectionFailure(remotePeerCode);
    }
  }

  private async selectBestTransport(): Promise<TransportMode> {
    try {
      // Check for local network availability first
      const localPeers = await this.networkDiscovery.findLocalPeers();
      if (localPeers.length > 0) {
        console.log('[NEGOTIATOR] Local network available, using mDNS');
        return 'mdns';
      }
    } catch (error) {
      console.warn('[NEGOTIATOR] Local network check failed:', error);
    }

    // Fallback to signaling
    console.log('[NEGOTIATOR] Using signaling transport');
    return 'signaling';
  }

  private async establishConnection(remotePeerCode: string, mode: TransportMode): Promise<void> {
    this.currentTransportMode = mode;
    const peerConnection = await this.connectionManager.createPeerConnection();
    
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new ConnectionError('Connection attempt timed out'));
      }, 30000); // 30 second timeout

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        this.onConnectionStateChange(state);

        if (state === 'connected') {
          console.log('[NEGOTIATOR] Connection established successfully');
          clearTimeout(timeoutId);
          this.connectionRetries = 0;
          resolve();
        } else if (state === 'failed' || state === 'closed') {
          clearTimeout(timeoutId);
          reject(new ConnectionError(`Connection ${state}`));
        }
      };

      if (mode === 'mdns') {
        this.setupLocalConnection(peerConnection, remotePeerCode).catch(reject);
      } else {
        this.setupSignalingConnection(peerConnection, remotePeerCode).catch(reject);
      }
    });
  }

  private async setupLocalConnection(
    peerConnection: RTCPeerConnection,
    remotePeerCode: string
  ): Promise<void> {
    // Configure for local network only
    peerConnection.iceTransportPolicy = 'all';
    
    const dataChannel = peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
      maxRetransmits: 3
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Use local discovery to find peer
    await this.networkDiscovery.startDiscovery();
  }

  private async setupSignalingConnection(
    peerConnection: RTCPeerConnection,
    remotePeerCode: string
  ): Promise<void> {
    const dataChannel = peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
      maxRetransmits: 3
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Use signaling service to exchange connection info
    await this.signalingService.sendSignal('offer', {
      offer,
      peerCode: remotePeerCode
    }, remotePeerCode);
  }

  private async handleConnectionFailure(remotePeerCode: string): Promise<void> {
    this.connectionRetries++;
    
    if (this.connectionRetries >= this.MAX_RETRIES) {
      throw new ConnectionError('Maximum connection retries exceeded');
    }

    console.log(`[NEGOTIATOR] Retrying connection (${this.connectionRetries}/${this.MAX_RETRIES})`);

    // If current mode failed, try alternative mode
    const nextMode = this.currentTransportMode === 'mdns' ? 'signaling' : 'mdns';
    
    try {
      await this.establishConnection(remotePeerCode, nextMode);
    } catch (error) {
      await this.handleConnectionFailure(remotePeerCode);
    }
  }

  getCurrentMode(): TransportMode | null {
    return this.currentTransportMode;
  }

  reset(): void {
    this.currentTransportMode = null;
    this.connectionRetries = 0;
  }
}
