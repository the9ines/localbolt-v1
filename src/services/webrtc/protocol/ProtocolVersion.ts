
export enum ProtocolVersion {
  V1 = "1.0.0"
}

export interface ProtocolMetadata {
  version: ProtocolVersion;
  capabilities: ConnectionCapabilities;
  deviceType: DeviceType;
  transportModes: TransportMode[];
}

export enum DeviceType {
  Web = "web",
  Desktop = "desktop",
  Mobile = "mobile"
}

export enum TransportMode {
  WebRTC = "webrtc",
  LAN = "lan",
  Internet = "internet"
}

export interface ConnectionCapabilities {
  supportsMDNS: boolean;
  supportsUDP: boolean;
  supportsLocalDiscovery: boolean;
  supportsFileTransfer: boolean;
  maxFileSize: number;
  supportedEncryption: string[];
}
