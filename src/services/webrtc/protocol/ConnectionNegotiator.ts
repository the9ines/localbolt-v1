
import { WebRTCError, ConnectionError } from '@/types/webrtc-errors';
import type { TransportMode } from '../types/discovery-types';
import { NetworkDiscovery } from '../discovery/NetworkDiscovery';
import { ConnectionManager } from '../ConnectionManager';
import { SignalingService } from '../SignalingService';

export class ConnectionNegotiator {
  private currentTransportMode: TransportMode | null = null;
  private connectionRetries: number = 0;
  private readonly MAX_RETRIES = 3;
  private connectionTimeoutId: NodeJS.Timeout | null = null;

  constructor(
    private networkDiscovery: NetworkDiscovery,
    private connectionManager: ConnectionManager,
    private signalingService: SignalingService,
    private onConnectionStateChange: (state: RTCPeerConnectionState) => void
  ) {}

  async negotiateConnection(remotePeerCode: string): Promise<void> {
    console.log('[NEGOTIATOR] Starting connection negotiation with peer:', remotePeerCode);
    
    try {
      // Always start with signaling transport for initial connection
      await this.establishConnection(remotePeerCode, 'signaling');
      
      // After connection is established, try to upgrade to local network if available
      this.tryUpgradeToLocalNetwork(remotePeerCode);
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
      // Clear any existing timeout
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
      }

      this.connectionTimeoutId = setTimeout(() => {
        reject(new ConnectionError('Connection attempt timed out'));
      }, 30000); // 30 second timeout

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('[NEGOTIATOR] Connection state changed:', state);
        this.onConnectionStateChange(state);

        if (state === 'connected') {
          console.log('[NEGOTIATOR] Connection established successfully');
          if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
          }
          this.connectionRetries = 0;
          resolve();
        } else if (state === 'failed' || state === 'closed') {
          if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
          }
          reject(new ConnectionError(`Connection ${state}`));
        }
      };

      // Set up data channel before creating offer
      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true,
        maxRetransmits: 3
      });

      dataChannel.onopen = () => {
        console.log('[NEGOTIATOR] Data channel opened');
      };

      dataChannel.onerror = (error) => {
        console.error('[NEGOTIATOR] Data channel error:', error);
      };

      if (mode === 'signaling') {
        this.setupSignalingConnection(peerConnection, remotePeerCode).catch(reject);
      } else {
        this.setupLocalConnection(peerConnection, remotePeerCode).catch(reject);
      }
    });
  }

  private async setupLocalConnection(
    peerConnection: RTCPeerConnection,
    remotePeerCode: string
  ): Promise<void> {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('[NEGOTIATOR] Created and set local description for local connection');

    // Use local discovery to find peer
    const localPeers = await this.networkDiscovery.findLocalPeers();
    const targetPeer = localPeers.find(peer => peer.deviceId === remotePeerCode);
    
    if (!targetPeer) {
      throw new ConnectionError('Target peer not found on local network');
    }
  }

  private async setupSignalingConnection(
    peerConnection: RTCPeerConnection,
    remotePeerCode: string
  ): Promise<void> {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('[NEGOTIATOR] Created and set local description for signaling connection');

    // Use signaling service to exchange connection info
    await this.signalingService.sendSignal('offer', {
      offer,
      peerCode: remotePeerCode
    }, remotePeerCode);
  }

  private async tryUpgradeToLocalNetwork(remotePeerCode: string): Promise<void> {
    try {
      const localTransport = await this.selectBestTransport();
      if (localTransport === 'mdns') {
        console.log('[NEGOTIATOR] Attempting to upgrade to local network connection');
        await this.establishConnection(remotePeerCode, 'mdns');
      }
    } catch (error) {
      console.warn('[NEGOTIATOR] Failed to upgrade to local network:', error);
      // Continue with existing connection
    }
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
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
    }
    this.currentTransportMode = null;
    this.connectionRetries = 0;
  }
}
