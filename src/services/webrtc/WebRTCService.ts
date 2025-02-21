
import { WebRTCError } from '@/types/webrtc-errors';
import { SignalingService, type SignalData } from './SignalingService';
import { EncryptionService } from './EncryptionService';
import { ConnectionManager } from './ConnectionManager';
import { SignalingHandler } from './SignalingHandler';
import { DataChannelManager } from './DataChannelManager';
import { ConnectionStateHandler } from './handlers/ConnectionStateHandler';
import { WebRTCStateManager } from './managers/WebRTCStateManager';
import { ConnectionService } from './services/ConnectionService';
import { FileTransferService } from './services/FileTransferService';
import type { TransferProgress } from './types/transfer';

class WebRTCService {
  private stateManager: WebRTCStateManager;
  private connectionService: ConnectionService;
  private fileTransferService: FileTransferService;
  private signalingHandler: SignalingHandler;
  private connectionStateHandler: ConnectionStateHandler;

  constructor(
    private localPeerCode: string,
    private onReceiveFile: (file: Blob, filename: string) => void,
    private onError: (error: WebRTCError) => void,
    private onProgress?: (progress: TransferProgress) => void,
    onRemotePeerCode?: (code: string) => void
  ) {
    console.log('[INIT] Creating WebRTC service with peer code:', localPeerCode);
    
    const encryptionService = new EncryptionService();
    
    this.connectionStateHandler = new ConnectionStateHandler(
      onRemotePeerCode,
      (state) => this.handleConnectionStateChange(state)
    );

    this.stateManager = new WebRTCStateManager(
      this.connectionStateHandler,
      this.onError,
      onProgress
    );
    
    const dataChannelManager = new DataChannelManager(
      encryptionService,
      this.onReceiveFile,
      (progress) => {
        console.log('[TRANSFER] Progress update:', progress);
        this.stateManager.updateProgress(progress);
      },
      this.handleError.bind(this)
    );

    const connectionManager = new ConnectionManager(
      (candidate) => {
        signalingService.sendSignal('ice-candidate', candidate, this.stateManager.getRemotePeerCode())
          .catch(error => {
            console.error('[ICE] Failed to send candidate:', error);
            this.handleError(error as WebRTCError);
          });
      },
      this.handleError.bind(this),
      (channel) => dataChannelManager.setupDataChannel(channel)
    );

    const signalingService = new SignalingService(localPeerCode, this.handleSignal.bind(this));
    
    this.signalingHandler = new SignalingHandler(
      connectionManager,
      encryptionService,
      signalingService,
      localPeerCode,
      (channel) => dataChannelManager.setupDataChannel(channel)
    );

    this.connectionService = new ConnectionService(
      connectionManager,
      dataChannelManager,
      signalingService,
      encryptionService,
      this.stateManager
    );

    this.fileTransferService = new FileTransferService(
      dataChannelManager,
      this.stateManager
    );
  }

  private handleConnectionStateChange(state: RTCPeerConnectionState) {
    this.stateManager.handleConnectionStateChange(state);
    if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      this.stateManager.handleDisconnection();
    }
  }

  private async handleSignal(signal: SignalData) {
    if (signal.to !== this.localPeerCode) return;

    try {
      if (signal.from && !this.stateManager.getRemotePeerCode()) {
        this.stateManager.setRemotePeerCode(signal.from);
        this.stateManager.handleConnectionStateChange('connecting');
      }

      if (signal.type === 'disconnect') {
        this.stateManager.handleDisconnection();
        return;
      }

      await this.signalingHandler.handleSignal(signal);
    } catch (error) {
      console.error('[SIGNALING] Handler error:', error);
      throw error;
    }
  }

  private handleError(error: WebRTCError) {
    this.stateManager.handleError(error);
  }

  async connect(remotePeerCode: string): Promise<void> {
    await this.connectionService.connect(remotePeerCode);
  }

  setConnectionStateHandler(handler: (state: RTCPeerConnectionState) => void) {
    this.connectionStateHandler.setConnectionStateHandler(handler);
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.fileTransferService.setProgressCallback(callback);
  }

  async sendFile(file: File) {
    await this.fileTransferService.sendFile(file);
  }

  cancelTransfer(filename: string, isReceiver: boolean = false) {
    this.fileTransferService.cancelTransfer(filename, isReceiver);
  }

  disconnect() {
    this.connectionService.disconnect();
  }

  getRemotePeerCode(): string {
    return this.stateManager.getRemotePeerCode();
  }
}

export default WebRTCService;
