
import type { TransferProgress } from '../../types/transfer';
import type { TransferControlMessage, TransferState } from '../../types/transfer-control';

export interface IStateManager {
  getCurrentTransfer(): TransferState | null;
  startTransfer(filename: string, total: number): void;
  updateProgress(
    filename: string, 
    loaded: number, 
    total: number, 
    currentChunk: number, 
    totalChunks: number
  ): void;
  handlePause(message: TransferControlMessage): boolean;
  handleResume(message: TransferControlMessage): boolean;
  handleCancel(message: TransferControlMessage): void;
  handleDisconnect(): void;
  handleError(): void;
  resetTransferState(reason: 'cancel' | 'disconnect' | 'error' | 'complete'): void;
  isCancelled(): boolean;
  isPaused(): boolean;
}
