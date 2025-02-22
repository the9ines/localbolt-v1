
import { SignalingService, type SignalData } from './SignalingService';
import { ConnectionError } from '@/types/webrtc-errors';
import { ConnectionManager } from './ConnectionManager';
import { EncryptionService } from './EncryptionService';

export class SignalingHandler {
  private readonly pendingCandidates: RTCIceCandidateInit[] = [];
  private remotePeerCode: string = '';

  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly encryptionService: EncryptionService,
    private readonly signalingService: SignalingService,
    private readonly localPeerCode: string,
    private readonly onDataChannel: (channel: RTCDataChannel) => void
  ) {}

  private async handleOffer(signal: SignalData): Promise<void> {
    console.log('[SIGNALING] Received offer from peer:', signal.from);
    
    if (!signal.data?.publicKey || !signal.data?.offer) {
      throw new ConnectionError('Invalid offer data received');
    }
    
    this.encryptionService.setRemotePublicKey(signal.data.publicKey);
    this.remotePeerCode = signal.from;
    
    const peerConnection = await this.connectionManager.createPeerConnection();
    const offerDesc = new RTCSessionDescription(signal.data.offer);
    
    try {
      await peerConnection.setRemoteDescription(offerDesc);
      console.log('[SIGNALING] Set remote description (offer)');
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('[SIGNALING] Created and sending answer');
      
      await this.signalingService.sendSignal('answer', {
        answer,
        publicKey: this.encryptionService.getPublicKey(),
        peerCode: this.localPeerCode
      }, signal.from);

      await this.processPendingCandidates();
    } catch (error) {
      throw new ConnectionError('Failed to process offer', error);
    }
  }

  private async handleAnswer(signal: SignalData): Promise<void> {
    console.log('[SIGNALING] Received answer from peer:', signal.from);
    
    if (!signal.data?.publicKey || !signal.data?.answer) {
      throw new ConnectionError('Invalid answer data received');
    }
    
    this.encryptionService.setRemotePublicKey(signal.data.publicKey);
    this.remotePeerCode = signal.from;
    
    const peerConnection = this.connectionManager.getPeerConnection();
    if (!peerConnection) {
      throw new ConnectionError("No peer connection established");
    }

    if (peerConnection.signalingState === 'have-local-offer') {
      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(signal.data.answer)
        );
        console.log('[SIGNALING] Set remote description (answer)');
        await this.processPendingCandidates();
      } catch (error) {
        throw new ConnectionError('Failed to set remote description', error);
      }
    } else {
      throw new ConnectionError(
        "Received answer in invalid state",
        { state: peerConnection.signalingState }
      );
    }
  }

  private async processPendingCandidates(): Promise<void> {
    console.log('[ICE] Processing pending candidates:', this.pendingCandidates.length);
    const peerConnection = this.connectionManager.getPeerConnection();
    if (!peerConnection) return;

    const candidates = [...this.pendingCandidates];
    this.pendingCandidates.length = 0;

    for (const candidate of candidates) {
      try {
        await this.connectionManager.addIceCandidate(candidate);
        console.log('[ICE] Added pending candidate');
      } catch (error) {
        console.error('[ICE] Failed to add pending candidate:', error);
      }
    }
  }

  private async handleIceCandidate(signal: SignalData): Promise<void> {
    if (!signal.data) {
      console.error('[ICE] Received invalid ICE candidate data');
      return;
    }

    const peerConnection = this.connectionManager.getPeerConnection();
    
    if (!peerConnection || !peerConnection.remoteDescription) {
      console.log('[ICE] Queuing candidate - no connection or remote description');
      this.pendingCandidates.push(signal.data);
      return;
    }

    try {
      await this.connectionManager.addIceCandidate(signal.data);
      console.log('[ICE] Added ICE candidate in state:', peerConnection.signalingState);
    } catch (error) {
      console.log('[ICE] Failed to add candidate, queuing:', error);
      this.pendingCandidates.push(signal.data);
    }
  }

  getRemotePeerCode(): string {
    return this.remotePeerCode;
  }

  async handleSignal(signal: SignalData): Promise<void> {
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
        default:
          console.warn('[SIGNALING] Unhandled signal type:', signal.type);
      }
    } catch (error) {
      console.error('[SIGNALING] Handler error:', error);
      throw error instanceof ConnectionError ? error : new ConnectionError('Signal handling failed', error);
    }
  }
}
