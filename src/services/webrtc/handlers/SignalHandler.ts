
import { WebRTCError } from '@/types/webrtc-errors';
import type { SignalData } from '../SignalingService';
import { ConnectionManager } from '../ConnectionManager';
import { EncryptionService } from '../EncryptionService';

export class SignalHandler {
  private pendingCandidates: RTCIceCandidate[] = [];
  private isSettingRemoteDescription = false;

  constructor(
    private connectionManager: ConnectionManager,
    private encryptionService: EncryptionService,
    private onError: (error: WebRTCError) => void
  ) {}

  async handleSignal(signal: SignalData, remotePeerCodeSetter: (code: string) => void) {
    try {
      if (!signal.type || !signal.from) {
        throw new WebRTCError("Invalid signal format");
      }

      const peerConnection = this.connectionManager.getPeerConnection() || 
                           await this.connectionManager.createPeerConnection();

      switch (signal.type) {
        case 'offer':
          await this.handleOffer(signal, peerConnection, remotePeerCodeSetter);
          break;
        case 'answer':
          await this.handleAnswer(signal, peerConnection);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(signal.data, peerConnection);
          break;
        default:
          console.warn('[WEBRTC] Unknown signal type:', signal.type);
      }
    } catch (error) {
      this.onError(new WebRTCError("Signal handling failed", error));
    }
  }

  private async handleOffer(
    signal: SignalData, 
    peerConnection: RTCPeerConnection,
    remotePeerCodeSetter: (code: string) => void
  ) {
    console.log('[WEBRTC] Processing offer from:', signal.from);
    this.isSettingRemoteDescription = true;
    remotePeerCodeSetter(signal.from);
    
    if (!signal.data.offer || !signal.data.publicKey) {
      throw new WebRTCError("Invalid offer format");
    }
    
    this.encryptionService.setRemotePublicKey(signal.data.publicKey);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.offer));
    
    await this.processPendingCandidates();
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    this.isSettingRemoteDescription = false;
    return { answer, publicKey: this.encryptionService.getPublicKey() };
  }

  private async handleAnswer(signal: SignalData, peerConnection: RTCPeerConnection) {
    console.log('[WEBRTC] Processing answer from:', signal.from);
    if (!signal.data.answer || !signal.data.publicKey) {
      throw new WebRTCError("Invalid answer format");
    }
    
    this.encryptionService.setRemotePublicKey(signal.data.publicKey);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data.answer));
  }

  private async handleIceCandidate(candidate: RTCIceCandidate, peerConnection: RTCPeerConnection) {
    if (this.isSettingRemoteDescription) {
      console.log('[ICE] Queueing candidate while setting remote description');
      this.pendingCandidates.push(candidate);
    } else if (peerConnection.remoteDescription) {
      console.log('[ICE] Adding candidate immediately');
      await this.connectionManager.addIceCandidate(candidate);
    } else {
      console.log('[ICE] Queueing candidate - no remote description yet');
      this.pendingCandidates.push(candidate);
    }
  }

  private async processPendingCandidates() {
    console.log('[ICE] Processing pending candidates:', this.pendingCandidates.length);
    for (const candidate of this.pendingCandidates) {
      await this.connectionManager.addIceCandidate(candidate);
    }
    this.pendingCandidates = [];
  }

  reset() {
    this.pendingCandidates = [];
    this.isSettingRemoteDescription = false;
  }
}
