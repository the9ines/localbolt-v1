
import type { TransferProgress, FileChunkMessage } from './transfer';

export interface IFileTransferService {
  sendFile(file: File): Promise<void>;
  cancelCurrentTransfer(filename: string, isReceiver?: boolean): void;
  pauseTransfer(filename: string): void;
  resumeTransfer(filename: string): void;
}
