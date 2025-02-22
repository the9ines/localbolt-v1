
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';
import { TransferStore } from '../TransferStore';
import { ProgressEmitter } from '../ProgressEmitter';

export class PauseResumeHandler {
  private lastProgress: Map<string, TransferState['progress']> = new Map();
  private activeTransfers: Map<string, TransferState> = new Map();

  constructor(
    private store: TransferStore,
    private progressEmitter: ProgressEmitter
  ) {}

  handlePause({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing pause request for ${filename}`);
      
      const currentTransfer = this.store.getTransfer(filename);
      const currentProgress = currentTransfer?.progress || this.lastProgress.get(filename);
      
      if (!currentProgress) {
        console.warn('[STATE] No progress data found for pause:', filename);
        return false;
      }

      this.store.updateState({ isPaused: true });
      
      const transfer = {
        filename,
        total: currentProgress.total,
        progress: currentProgress
      };

      this.store.setTransfer(transfer);
      this.activeTransfers.set(filename, transfer);
      this.lastProgress.set(filename, currentProgress);

      console.log('[STATE] Emitting pause with progress:', currentProgress);
      this.progressEmitter.emit(filename, 'paused', currentProgress);

      return true;
    } catch (error) {
      console.error('[STATE] Error handling pause:', error);
      return false;
    }
  }

  handleResume({ filename }: TransferControlMessage): boolean {
    try {
      console.log(`[STATE] Processing resume request for ${filename}`);
      
      const currentTransfer = this.store.getTransfer(filename);
      const currentProgress = currentTransfer?.progress || this.lastProgress.get(filename);
      
      if (!currentProgress) {
        console.warn('[STATE] No progress data found for resume:', filename);
        return false;
      }

      this.store.updateState({ isPaused: false });
      
      const transfer = {
        filename,
        total: currentProgress.total,
        progress: currentProgress
      };

      this.store.setTransfer(transfer);
      this.activeTransfers.set(filename, transfer);

      console.log('[STATE] Emitting resume with progress:', currentProgress);
      this.progressEmitter.emit(filename, 'transferring', currentProgress);

      return true;
    } catch (error) {
      console.error('[STATE] Error handling resume:', error);
      return false;
    }
  }

  getLastProgress(filename: string): TransferState['progress'] | undefined {
    return this.lastProgress.get(filename);
  }

  setLastProgress(filename: string, progress: TransferState['progress']): void {
    this.lastProgress.set(filename, progress);
  }

  clearProgress(): void {
    this.lastProgress.clear();
    this.activeTransfers.clear();
  }
}
