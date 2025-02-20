
import { SignalingService, type SignalData } from './SignalingService';
import { ConnectionError } from '@/types/webrtc-errors';
import { ConnectionManager } from './ConnectionManager';
import { EncryptionService } from './EncryptionService';

export class SignalingHandler {
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(
    private connectionManager: ConnectionManager,
    private encryptionService: EncryptionService,
    private signalingService: SignalingService,
    private localPeerCode: string,
    private onDataChannel: (channel: RTCDataChannel) => void
  ) {}

  private async handleOffer(signal: SignalData) {
    console.log('[SIGNALING] Received offer from peer:', signal.from);
    this.encryptionService.setRemotePublicKey(signal.data.publicKey);
    
    const peerConnection = await this.connectionManager.createPeerConnection();
    const offerDesc = new RTCSessionDescription(signal.data.offer);
    await peerConnection.setRemoteDescription(offerDesc);
    console.log('[SIGNALING] Set remote description (offer)');
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    console.log('[SIGNALING] Created and sending answer');
    
    await this.signalingService.sendSignal('answer', {
      answer,
      publicKey: this.encryptionService.getPublicKey()
    }, signal.from);

    // Process any pending candidates after setting descriptions
    await this.processPendingCandidates();
  }

  private async handleAnswer(signal: SignalData) {
    console.log('[SIGNALING] Received answer from peer:', signal.from);
    this.encryptionService.setRemotePublicKey(signal.data.publicKey);
    
    const peerConnection = this.connectionManager.getPeerConnection();
    if (!peerConnection) {
      throw new ConnectionError("No peer connection established");
    }

    if (peerConnection.signalingState === 'have-local-offer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
      console.log('[SIGNALING] Set remote description (answer)');
      
      // Process any pending candidates after setting descriptions
      await this.processPendingCandidates();
    } else {
      throw new ConnectionError(
        "Received answer in invalid state",
        { state: peerConnection.signalingState }
      );
    }
  }

  private async processPendingCandidates() {
    console.log('[ICE] Processing pending candidates:', this.pendingCandidates.length);
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        await this.connectionManager.addIceCandidate(candidate);
        console.log('[ICE] Added pending candidate');
      }
    }
  }

  private async handleIceCandidate(signal: SignalData) {
    const peerConnection = this.connectionManager.getPeerConnection();
    if (!peerConnection) {
      console.log('[ICE] No peer connection, queuing candidate');
      this.pendingCandidates.push(signal.data);
      return;
    }

    const signalingState = peerConnection.signalingState;
    if (signalingState === 'stable' || signalingState === 'have-remote-offer' || signalingState === 'have-local-offer') {
      await this.connectionManager.addIceCandidate(signal.data);
      console.log('[ICE] Added ICE candidate in state:', signalingState);
    } else {
      console.log('[ICE] Queuing candidate due to signaling state:', signalingState);
      this.pendingCandidates.push(signal.data);
    }
  }

  async handleSignal(signal: SignalData) {
    if (signal.to !== this.localPeerCode) return;
    console.log('[SIGNALING] Processing signal:', signal.type, 'from:', signal.from);

    try {
      switch (signal.type) {
        case 'offer':
          await this.handleOffer(signal);
          break;
        case 'answer':
          await this.handleAnswer(signal);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(signal);
          break;
      }
    } catch (error) {
      console.error('[SIGNALING] Handler error:', error);
      throw error;
    }
  }
}
