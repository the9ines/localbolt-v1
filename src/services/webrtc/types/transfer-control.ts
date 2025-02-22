
export interface TransferControl {
  isPaused: boolean;
  isCancelled: boolean;
  currentTransfer: { filename: string; total: number } | null;
}

export interface TransferControlMessage {
  filename: string;
  isReceiver?: boolean;
}
