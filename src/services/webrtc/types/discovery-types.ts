
export type NetworkType = 'local' | 'internet';
export type TransportMode = 'mdns' | 'signaling';

export interface PeerCapabilities {
  mdns: boolean;
  webrtc: boolean;
  encryption: string[];
}

export interface PeerInfo {
  deviceId: string;
  capabilities: PeerCapabilities;
  networkType: NetworkType;
}

export interface DiscoveredPeer extends PeerInfo {
  timestamp: number;
  signal?: RTCSessionDescriptionInit;
}
