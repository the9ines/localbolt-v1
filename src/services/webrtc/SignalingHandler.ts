
import { SignalingService, type SignalData } from './SignalingService';
import { ConnectionError } from '@/types/webrtc-errors';
import { ConnectionManager } from './ConnectionManager';
import { EncryptionService } from './EncryptionService';

export class SignalingHandler {
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remotePeerCode: string = '';
  private hasReceivedOffer: boolean = false;
  private hasReceivedAnswer: boolean = false;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly CONNECTION_TIMEOUT = 30000; // 30 seconds

  constructor(
    private connectionManager: ConnectionManager,
    private encryptionService: EncryptionService,
    private signalingService: SignalingService,
    private localPeerCode: string,
    private onDataChannel: (channel: RTCDataChannel) => void
  ) {}

  private async handleOffer(signal: SignalData) {
    console.log('[SIGNALING] Processing offer from peer:', signal.from);
    this.hasReceivedOffer = true;
    this.encryptionService.setRemotePublicKey(signal.data.publicKey);
    
    this.remotePeerCode = signal.from;
    
    const peerConnection = await this.connectionManager.createPeerConnection();
    
    try {
      // Set remote description first
      const offerDesc = new RTCSessionDescription(signal.data.offer);
      await peerConnection.setRemoteDescription(offerDesc);
      console.log('[SIGNALING] Set remote description (offer)');
      
      // Create and set local answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('[SIGNALING] Created and sending answer');
      
      await this.signalingService.sendSignal('answer', {
        answer,
        publicKey: this.encryptionService.getPublicKey(),
        peerCode: this.localPeerCode
      }, signal.from);

      // Set connection timeout
      this.setConnectionTimeout();

      // Now that we have both descriptions, process any pending candidates
      console.log('[SIGNALING] Processing pending candidates after offer');
      await this.processPendingCandidates();
    } catch (error) {
      console.error('[SIGNALING] Error handling offer:', error);
      throw new ConnectionError("Failed to process offer", error);
    }
  }

  private async handleAnswer(signal: SignalData) {
    console.log('[SIGNALING] Processing answer from peer:', signal.from);
    this.hasReceivedAnswer = true;
    this.encryptionService.setRemotePublicKey(signal.data.publicKey);
    
    this.remotePeerCode = signal.from;
    
    const peerConnection = this.connectionManager.getPeerConnection();
    if (!peerConnection) {
      throw new ConnectionError("No peer connection established");
    }

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
      console.log('[SIGNALING] Set remote description (answer)');
      
      // Set connection timeout
      this.setConnectionTimeout();
      
      // Process any pending candidates now that we have both descriptions
      console.log('[SIGNALING] Processing pending candidates after answer');
      await this.processPendingCandidates();
    } catch (error) {
      console.error('[SIGNALING] Error handling answer:', error);
      throw new ConnectionError("Failed to process answer", error);
    }
  }

  private setConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    
    this.connectionTimeout = setTimeout(() => {
      if (!this.connectionManager.isConnected()) {
        console.error('[SIGNALING] Connection timeout');
        this.resetState();
        throw new ConnectionError("Connection timeout");
      }
    }, this.CONNECTION_TIMEOUT);
  }

  private resetState() {
    this.hasReceivedOffer = false;
    this.hasReceivedAnswer = false;
    this.pendingCandidates = [];
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private async processPendingCandidates() {
    console.log('[ICE] Processing pending candidates:', this.pendingCandidates.length);
    const peerConnection = this.connectionManager.getPeerConnection();
    if (!peerConnection) return;

    // Ensure we have either received an offer or answer before processing candidates
    if (!this.hasReceivedOffer && !this.hasReceivedAnswer) {
      console.log('[ICE] Waiting for offer/answer before processing candidates');
      return;
    }

    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.connectionManager.addIceCandidate(candidate);
          console.log('[ICE] Successfully added pending candidate');
        } catch (error) {
          console.error('[ICE] Failed to add pending candidate:', error);
          // Put the candidate back if we're not ready
          if (error instanceof Error && error.message.includes('remote description')) {
            this.pendingCandidates.unshift(candidate);
            break;
          }
        }
      }
    }
  }

  private async handleIceCandidate(signal: SignalData) {
    console.log('[ICE] Received ICE candidate');
    const peerConnection = this.connectionManager.getPeerConnection();
    
    // Queue the candidate if we don't have a connection or haven't processed offer/answer
    if (!peerConnection || (!this.hasReceivedOffer && !this.hasReceivedAnswer)) {
      console.log('[ICE] Queuing candidate - waiting for offer/answer');
      this.pendingCandidates.push(signal.data);
      return;
    }

    try {
      await this.connectionManager.addIceCandidate(signal.data);
      console.log('[ICE] Added ICE candidate immediately');
    } catch (error) {
      console.log('[ICE] Failed to add candidate, queuing:', error);
      this.pendingCandidates.push(signal.data);
    }
  }

  getRemotePeerCode(): string {
    return this.remotePeerCode;
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
      this.resetState();
      throw error;
    }
  }
}
