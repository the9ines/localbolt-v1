
import { ProtocolHandler } from './ProtocolHandler';
import { ConnectionMessage, MessageType } from './ConnectionMessage';
import { TransportMode, DeviceType } from './ProtocolVersion';
import { WebRTCError } from '@/types/webrtc-errors';

export class ConnectionNegotiator {
  constructor(
    private protocolHandler: ProtocolHandler,
    private localPeerId: string
  ) {}

  public async negotiateConnection(
    remotePeerId: string,
    remoteDeviceType: DeviceType
  ): Promise<TransportMode> {
    console.log('[NEGOTIATOR] Starting connection negotiation with:', remotePeerId);
    
    try {
      // Create initial connection request
      const preferredTransports = this.getPreferredTransports(remoteDeviceType);
      const request = this.protocolHandler.createConnectionRequest(
        this.localPeerId,
        preferredTransports
      );

      // Validate capabilities and determine transport mode
      const localMetadata = this.protocolHandler.getProtocolMetadata();
      const negotiatedTransport = this.protocolHandler.getNegotiatedTransport(
        localMetadata,
        request.protocol
      );

      console.log('[NEGOTIATOR] Negotiated transport mode:', negotiatedTransport);
      return negotiatedTransport;
    } catch (error) {
      throw new WebRTCError(
        'Failed to negotiate connection',
        { remotePeerId, error }
      );
    }
  }

  private getPreferredTransports(remoteDeviceType: DeviceType): TransportMode[] {
    const transports: TransportMode[] = [];

    // Web clients must use WebRTC
    if (remoteDeviceType === DeviceType.Web) {
      return [TransportMode.WebRTC];
    }

    // Native clients can use multiple transport modes
    transports.push(TransportMode.LAN);
    transports.push(TransportMode.WebRTC);
    transports.push(TransportMode.Internet);

    return transports;
  }

  public validateIncomingMessage(message: ConnectionMessage): boolean {
    if (!this.protocolHandler.validateMessage(message)) {
      return false;
    }

    // Additional validation specific to connection negotiation
    if (!message.peerId) {
      console.error('[NEGOTIATOR] Missing peer ID in message');
      return false;
    }

    return true;
  }
}
