
import { ConnectionMessage, MessageType } from './ConnectionMessage';
import { ProtocolMetadata, ProtocolVersion, DeviceType, TransportMode } from './ProtocolVersion';

export class ProtocolHandler {
  private readonly protocolMetadata: ProtocolMetadata;

  constructor() {
    this.protocolMetadata = {
      version: ProtocolVersion.V1,
      deviceType: DeviceType.Web,
      transportModes: [TransportMode.WebRTC, TransportMode.Internet],
      capabilities: {
        supportsMDNS: false,
        supportsUDP: false,
        supportsLocalDiscovery: false,
        supportsFileTransfer: true,
        maxFileSize: Number.MAX_SAFE_INTEGER,
        supportedEncryption: ['tweetnacl']
      }
    };
  }

  public validateMessage(message: ConnectionMessage): boolean {
    if (!message.protocol || !message.protocol.version) {
      console.error('[PROTOCOL] Invalid message format - missing protocol version');
      return false;
    }

    if (message.protocol.version !== ProtocolVersion.V1) {
      console.error('[PROTOCOL] Unsupported protocol version:', message.protocol.version);
      return false;
    }

    return true;
  }

  public createHelloMessage(peerId: string): ConnectionMessage {
    return {
      type: MessageType.HELLO,
      peerId,
      timestamp: Date.now(),
      protocol: this.protocolMetadata
    };
  }

  public createConnectionRequest(
    peerId: string,
    preferredTransport: TransportMode[] = [TransportMode.WebRTC],
    remoteDeviceType?: DeviceType
  ): ConnectionMessage {
    return {
      type: MessageType.CONNECTION_REQUEST,
      peerId,
      timestamp: Date.now(),
      protocol: {
        ...this.protocolMetadata,
        deviceType: remoteDeviceType || this.protocolMetadata.deviceType
      },
      preferredTransport
    };
  }

  public createErrorMessage(
    peerId: string,
    code: string,
    message: string,
    details?: any
  ): ConnectionMessage {
    return {
      type: MessageType.ERROR,
      peerId,
      timestamp: Date.now(),
      protocol: this.protocolMetadata,
      code,
      message,
      details
    };
  }

  public getNegotiatedTransport(
    localCapabilities: ProtocolMetadata,
    remoteCapabilities: ProtocolMetadata
  ): TransportMode {
    // Prioritize WebRTC for web clients
    if (localCapabilities.deviceType === DeviceType.Web || 
        remoteCapabilities.deviceType === DeviceType.Web) {
      return TransportMode.WebRTC;
    }

    // For native clients, prefer LAN if available
    if (localCapabilities.capabilities.supportsLocalDiscovery && 
        remoteCapabilities.capabilities.supportsLocalDiscovery) {
      return TransportMode.LAN;
    }

    // Fallback to Internet transport
    return TransportMode.Internet;
  }

  public getProtocolMetadata(): ProtocolMetadata {
    return this.protocolMetadata;
  }
}
