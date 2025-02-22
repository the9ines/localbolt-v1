
import type { TransferControlMessage } from '../../types/transfer-control';
import { TransferStateService } from '../services/TransferStateService';
import { ProgressEmitter } from '../ProgressEmitter';

export class TransferControlHandler {
  constructor(
    private stateService: TransferStateService,
    private progressEmitter: ProgressEmitter
  ) {}

  handlePause(message: TransferControlMessage): boolean {
    if (message.filename && this.stateService.isTransferActive(message.filename)) {
      this.stateService.updateState({ isPaused: true });
      const transfer = this.stateService.getTransfer(message.filename);
      if (transfer?.progress) {
        this.stateService.updateProgress(
          message.filename,
          transfer.progress.loaded,
          transfer.progress.total,
          transfer.progress.currentChunk,
          transfer.progress.totalChunks,
          'paused'
        );
      }
      return true;
    }
    return false;
  }

  handleResume(message: TransferControlMessage): boolean {
    if (message.filename && this.stateService.isTransferActive(message.filename)) {
      this.stateService.updateState({ isPaused: false });
      const transfer = this.stateService.getTransfer(message.filename);
      if (transfer?.progress) {
        this.stateService.updateProgress(
          message.filename,
          transfer.progress.loaded,
          transfer.progress.total,
          transfer.progress.currentChunk,
          transfer.progress.totalChunks,
          'transferring'
        );
      }
      return true;
    }
    return false;
  }

  handleCancel(message: TransferControlMessage): void {
    if (message.filename) {
      this.stateService.updateState({ isCancelled: true });
      
      // Default to 'canceled_by_sender' if cancelledBy is not specified
      const cancelStatus = message.isReceiver ? 'canceled_by_receiver' : 'canceled_by_sender';
      
      this.stateService.updateProgress(
        message.filename,
        0,
        0,
        0,
        0,
        cancelStatus
      );
      this.stateService.removeTransfer(message.filename);
    }
  }

  reset(): void {
    console.log('[STATE] Resetting transfer control state');
    this.stateService.reset();
  }
}
