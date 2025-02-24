
export interface ConnectionState {
  isConnected: boolean;
  lastConnectedAt: number | null;
  reconnectAttempts: number;
  lastError: Error | null;
  candidateCache: Map<string, RTCIceCandidate>;
}
