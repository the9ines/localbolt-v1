
import { SignalingService, type SignalData } from '../SignalingService';
import { SignalingHandler } from '../SignalingHandler';
import { ConnectionManager } from '../ConnectionManager';
import { EncryptionService } from '../EncryptionService';

export class SignalingManager {
  private signalingHandler: SignalingHandler;

  constructor(
    private signalingService: SignalingService,
    private connectionManager: ConnectionManager,
    private encryptionService: EncryptionService,
    private localPeerCode: string,
    onDataChannel: (channel: RTCDataChannel) => void
  ) {
    this.signalingHandler = new SignalingHandler(
      connectionManager,
      encryptionService,
      signalingService,
      localPeerCode,
      onDataChannel
    );
  }

  async handleSignal(signal: SignalData, remotePeerCode: string, onStateChange: (state: RTCPeerConnectionState) => void) {
    if (signal.to !== this.localPeerCode) return false;

    try {
      if (signal.from && !remotePeerCode) {
        onStateChange('connecting');
      }

      const signalType = signal.type as string | undefined;
      if (signalType && signalType === 'disconnect') {
        return true; // Indicate disconnect signal received
      }

      await this.signalingHandler.handleSignal(signal);
      return false;
    } catch (error) {
      console.error('[SIGNALING] Handler error:', error);
      throw error;
    }
  }
}
